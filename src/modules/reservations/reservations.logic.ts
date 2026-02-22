import { CapacityRepository } from "../../repository/capacity.repository";
import { ReservationRepository } from "../../repository/reservation.repository";
import { WaitlistRepository } from "../../repository/waitlist.repository";
import { createQRPayload, generateQRCodeImage, parseQRContent, verifyQRPayload } from "../../utils/qr.utils";
import { notifyNewReservation, notifyReservationCancelled } from "../../services/notifications/notification.triggers";
import { mailQueue } from "../../queue/notification.queue";

export class ReservationsLogic {
    constructor(
        private readonly capacityRepo: CapacityRepository,
        private readonly reservationRepo: ReservationRepository,
        private readonly waitlistRepo: WaitlistRepository
    ) {}

    async create(userId: string, userEmail: string, userName: string, data: any) {
        const { venueMatchId, partySize, requiresAccessibility, specialRequests } = data;

        // Get venue match details
        const venueMatch = await this.capacityRepo.getVenueMatch(venueMatchId);
        if (!venueMatch) {
            throw new Error("VENUE_MATCH_NOT_FOUND");
        }

        const bookingMode = venueMatch.venue?.booking_mode || 'INSTANT';

        // Check availability
        const availability = await this.capacityRepo.checkAvailability(venueMatchId, partySize);
        if (!availability.available) {
            throw new Error("NO_CAPACITY");
        }

        const reservationId = crypto.randomUUID();
        const matchStartTime = venueMatch.match?.scheduled_at 
            ? new Date(venueMatch.match.scheduled_at)
            : new Date(Date.now() + 24 * 60 * 60 * 1000);

        if (bookingMode === 'INSTANT') {
            const holdResult = await this.capacityRepo.createHold(venueMatchId, userId, partySize);
            if (!holdResult.success || !holdResult.hold) {
                throw new Error("CAPACITY_HOLD_FAILED");
            }

            const confirmResult = await this.capacityRepo.confirmHold(holdResult.hold.id);
            if (!confirmResult.success) {
                throw new Error("CONFIRM_HOLD_FAILED");
            }

            const qrPayload = createQRPayload(reservationId, userId, venueMatchId, "", matchStartTime);
            const qrPayloadString = JSON.stringify(qrPayload);

            const reservation = await this.reservationRepo.createWithQR(
                reservationId,
                userId, 
                venueMatchId, 
                partySize, 
                specialRequests || "",
                qrPayloadString
            );

            if (!reservation) {
                await this.capacityRepo.releaseReservedCapacity(venueMatchId, partySize);
                throw new Error("RESERVATION_CREATION_FAILED");
            }

            const qrCodeImage = await generateQRCodeImage(qrPayload);

            notifyNewReservation({
                venueMatchId,
                reservationId: reservation.id,
                userId: userId,
                partySize,
                status: 'confirmed'
            }).catch(err => console.error('[Reservations] Failed to send notification:', err));

            await mailQueue.add("reservation-confirmation", {
                to: userEmail,
                data: {
                    userName: userName,
                    venueName: venueMatch.venue?.name,
                    matchName: `${venueMatch.match?.homeTeam?.name || 'TBD'} vs ${venueMatch.match?.awayTeam?.name || 'TBD'}`,
                    date: venueMatch.match?.scheduled_at,
                    time: venueMatch.match?.scheduled_at ? new Date(venueMatch.match.scheduled_at).toLocaleTimeString() : '',
                    guests: partySize,
                    bookingId: reservation.id,
                    address: venueMatch.venue?.street_address
                }
            }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 }
            });
            
            return {
                message: "Reservation confirmed! Show this QR code at the venue.",
                reservation: {
                    id: reservation.id,
                    status: 'CONFIRMED',
                    partySize,
                    venueMatchId,
                    venue: venueMatch.venue?.name,
                    match: venueMatch.match ? { 
                        scheduledAt: venueMatch.match.scheduled_at,
                        homeTeam: venueMatch.match.homeTeam,
                        awayTeam: venueMatch.match.awayTeam,
                        league: venueMatch.match.league
                    } : null
                },
                qr_code: qrCodeImage
            };
        } else {
            const reservation = await this.reservationRepo.createPending(
                reservationId,
                userId,
                venueMatchId,
                partySize,
                specialRequests || "",
                requiresAccessibility ?? false
            );

            if (!reservation) throw new Error("RESERVATION_CREATION_FAILED");

            notifyNewReservation({
                venueMatchId,
                reservationId: reservation.id,
                userId: userId,
                partySize,
                status: 'pending'
            }).catch(err => console.error('[Reservations] Failed to send notification:', err));

            return {
                message: "Reservation request submitted. The venue will confirm shortly.",
                reservation: {
                    id: reservation.id,
                    status: 'PENDING',
                    partySize,
                    venueMatchId,
                    venue: venueMatch.venue?.name,
                    match: venueMatch.match ? { 
                        scheduledAt: venueMatch.match.scheduled_at,
                        homeTeam: venueMatch.match.homeTeam,
                        awayTeam: venueMatch.match.awayTeam,
                        league: venueMatch.match.league
                    } : null
                }
            };
        }
    }

    async list(userId: string) {
        return await this.reservationRepo.findByUserId(userId);
    }

    async getById(userId: string, reservationId: string) {
        const reservation = await this.reservationRepo.findById(reservationId);
        if (!reservation) throw new Error("RESERVATION_NOT_FOUND");
        if (reservation.user_id !== userId) throw new Error("FORBIDDEN");

        let qrCodeImage = null;
        if (reservation.qr_code) {
            try {
                const payload = JSON.parse(reservation.qr_code);
                qrCodeImage = await generateQRCodeImage(payload);
            } catch {
                qrCodeImage = reservation.qr_code;
            }
        }

        return { reservation, qrCode: qrCodeImage };
    }

    async cancel(userId: string, reservationId: string, reason?: string) {
        const canceled = await this.reservationRepo.cancel(reservationId, userId, reason);
        if (!canceled) throw new Error("RESERVATION_NOT_FOUND_OR_CANNOT_CANCEL");

        if (canceled.venue_match_id && canceled.party_size) {
            await this.capacityRepo.releaseReservedCapacity(canceled.venue_match_id, canceled.party_size);
            notifyReservationCancelled({
                venueMatchId: canceled.venue_match_id,
                reservationId: canceled.id,
                userId: userId,
                partySize: canceled.party_size,
                reason
            }).catch(err => console.error('Failed to send cancellation notification:', err));
        }

        return { message: "Reservation canceled successfully", reservation: canceled };
    }

    async joinWaitlist(userId: string, data: any) {
        const { venueMatchId, partySize, requiresAccessibility } = data;
        const result = await this.waitlistRepo.addToWaitlist(userId, venueMatchId, partySize, requiresAccessibility ?? false);

        if (!result.entry) throw new Error("WAITLIST_ADD_FAILED");

        const position = await this.waitlistRepo.getPosition(result.entry.id);

        return {
            message: result.alreadyInQueue ? "You're already on the waitlist" : "Added to waitlist",
            waitlistId: result.entry.id,
            position,
            alreadyInQueue: result.alreadyInQueue
        };
    }

    async leaveWaitlist(userId: string, waitlistId: string) {
        const removed = await this.waitlistRepo.removeFromWaitlist(waitlistId, userId);
        if (!removed) throw new Error("WAITLIST_ENTRY_NOT_FOUND");
        return { message: "Removed from waitlist" };
    }

    async getWaitlist(userId: string) {
        const entries = await this.waitlistRepo.findByUserId(userId);
        return await Promise.all(entries.map(async (entry) => ({
            ...entry,
            position: await this.waitlistRepo.getPosition(entry.id)
        })));
    }

    async verifyQR(userId: string, qrContent: string) {
        // TODO: Verify user is venue owner logic should be handled by caller or here if we have venue info in context
        const payload = parseQRContent(qrContent);
        if (!payload) throw new Error("INVALID_QR_FORMAT");

        const verification = verifyQRPayload(payload);
        if (!verification.valid) throw new Error(verification.error || "INVALID_QR");

        const reservation = await this.reservationRepo.findById(payload.rid);
        if (!reservation) throw new Error("RESERVATION_NOT_FOUND");

        if (reservation.status === 'checked_in') {
            return {
                valid: true,
                alreadyCheckedIn: true,
                message: "This reservation has already been checked in",
                reservation: {
                    id: reservation.id,
                    partySize: reservation.party_size,
                    table: reservation.table,
                    checkedInAt: reservation.checked_in_at
                }
            };
        }

        if (reservation.status !== 'confirmed') {
            throw new Error(`RESERVATION_STATUS_${reservation.status.toUpperCase()}`);
        }

        return {
            valid: true,
            message: "QR code verified! Ready to check in.",
            reservation: {
                id: reservation.id,
                partySize: reservation.party_size,
                userName: reservation.user_id 
            }
        };
    }

    async checkIn(userId: string, reservationId: string) {
        // TODO: Verify user is venue owner
        const checkedIn = await this.reservationRepo.checkIn(reservationId);
        if (!checkedIn) throw new Error("RESERVATION_NOT_FOUND_OR_CHECKED_IN");

        return { message: "Guest checked in successfully!", reservation: checkedIn };
    }

    async getVenueReservations(userId: string, venueMatchId: string) {
        // TODO: Verify user is venue owner
        const reservations = await this.reservationRepo.findByVenueMatchId(venueMatchId);
        const stats = {
            total: reservations.length,
            checkedIn: reservations.filter(r => r.status === 'checked_in').length,
            pending: reservations.filter(r => r.status === 'confirmed').length,
            totalGuests: reservations.reduce((sum, r) => sum + (r.party_size || 0), 0)
        };

        return { reservations, stats };
    }
}
