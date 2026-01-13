import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import type { HonoEnv } from "../../types/hono.types";
import { CapacityRepository } from "../../repository/capacity.repository";
import { ReservationRepository } from "../../repository/reservation.repository";
import { WaitlistRepository } from "../../repository/waitlist.repository";
import { HoldTableSchema, ConfirmReservationSchema, CancelReservationSchema, VerifyQRSchema } from "../../utils/reservation.valid";
import { createQRPayload, generateQRCodeImage, parseQRContent, verifyQRPayload } from "../../utils/qr.utils";

class ReservationsController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly capacityRepo = new CapacityRepository();
    private readonly reservationRepo = new ReservationRepository();
    private readonly waitlistRepo = new WaitlistRepository();

    /**
     * 1. Hold Capacity (Atomic - handles concurrent requests safely)
     * Decrements available capacity atomically to prevent overbooking
     */
    readonly holdTable = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = HoldTableSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const { venueMatchId, partySize } = c.req.valid('json');

        // Check availability first
        const availability = await this.capacityRepo.checkAvailability(venueMatchId, partySize);
        
        if (!availability.available) {
            return c.json({ 
                error: availability.message || "No capacity available",
                canJoinWaitlist: true,
                availableCapacity: availability.availableCapacity,
                maxGroupSize: availability.maxGroupSize,
                message: "Would you like to join the waitlist? You'll be notified when space becomes available."
            }, 409);
        }

        // Create atomic hold
        const result = await this.capacityRepo.createHold(venueMatchId, user.id, partySize);

        if (!result.success || !result.hold) {
            return c.json({ 
                error: result.message || "Failed to create hold",
                canJoinWaitlist: true
            }, 409);
        }

        return c.json({
            message: "Reservation held for 15 minutes. Please confirm your booking.",
            holdId: result.hold.id,
            expiresAt: result.hold.expiresAt,
            partySize: result.hold.partySize,
            venueMatchId: result.hold.venueMatchId
        });
    });

    /**
     * 2. Confirm Reservation from Hold
     * Converts a temporary hold into a confirmed reservation with signed QR code
     */
    readonly confirmReservation = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = ConfirmReservationSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const { holdId, specialRequests } = c.req.valid('json');

        // Get and validate hold
        const hold = this.capacityRepo.getHold(holdId);

        if (!hold) {
            return c.json({ error: "Hold not found or expired" }, 404);
        }

        if (hold.userId !== user.id) {
            return c.json({ error: "Forbidden" }, 403);
        }

        // Confirm the hold (moves capacity from held to reserved)
        const confirmResult = await this.capacityRepo.confirmHold(holdId);
        
        if (!confirmResult.success) {
            return c.json({ error: confirmResult.message || "Failed to confirm hold" }, 400);
        }

        // Get venue match details for context
        const venueMatch = await this.capacityRepo.getVenueMatch(hold.venueMatchId);
        const matchStartTime = venueMatch?.match?.scheduled_at 
            ? new Date(venueMatch.match.scheduled_at)
            : new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Generate reservation ID first so we can create QR payload
        const reservationId = crypto.randomUUID();

        // Generate signed QR code payload BEFORE creating reservation
        const qrPayload = createQRPayload(
            reservationId,
            user.id,
            hold.venueMatchId,
            "", // No table_id
            matchStartTime
        );
        const qrPayloadString = JSON.stringify(qrPayload);

        // Create reservation record with QR code included
        const reservation = await this.reservationRepo.createWithQR(
            reservationId,
            user.id, 
            hold.venueMatchId, 
            hold.partySize, 
            specialRequests || "",
            qrPayloadString
        );

        if (!reservation) {
            // Rollback: release the capacity
            await this.capacityRepo.releaseReservedCapacity(hold.venueMatchId, hold.partySize);
            return c.json({ error: "Failed to create reservation" }, 500);
        }
        
        // Generate image for response only
        const qrCodeImage = await generateQRCodeImage(qrPayload);
        
        return c.json({
            message: "Reservation confirmed! Show this QR code at the venue.",
            reservation: {
                id: reservation.id,
                status: 'confirmed',
                partySize: hold.partySize,
                venueMatchId: hold.venueMatchId,
                venue: venueMatch?.venue?.name,
                match: venueMatch?.match ? {
                    scheduledAt: venueMatch.match.scheduled_at
                } : null
            },
            qrCode: qrCodeImage
        });
    });

    /**
     * 3. Create Reservation (instant or request mode)
     * Backend decides PENDING vs CONFIRMED based on venue.booking_mode
     */
    readonly create = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = HoldTableSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const { venueMatchId, partySize, requiresAccessibility, specialRequests } = c.req.valid('json');

        // Get venue match details including venue's booking_mode
        const venueMatch = await this.capacityRepo.getVenueMatch(venueMatchId);
        if (!venueMatch) {
            return c.json({ error: "Venue match not found" }, 404);
        }

        // Get venue booking mode (default to INSTANT if not set)
        const bookingMode = venueMatch.venue?.booking_mode || 'INSTANT';

        // Check availability
        const availability = await this.capacityRepo.checkAvailability(venueMatchId, partySize);
        
        if (!availability.available) {
            return c.json({ 
                error: availability.message || "No capacity available",
                availableCapacity: availability.availableCapacity,
                maxGroupSize: availability.maxGroupSize,
            }, 409);
        }

        // Generate reservation ID
        const reservationId = crypto.randomUUID();
        const matchStartTime = venueMatch.match?.scheduled_at 
            ? new Date(venueMatch.match.scheduled_at)
            : new Date(Date.now() + 24 * 60 * 60 * 1000);

        if (bookingMode === 'INSTANT') {
            // INSTANT mode: Create hold and immediately confirm
            const holdResult = await this.capacityRepo.createHold(venueMatchId, user.id, partySize);
            
            if (!holdResult.success || !holdResult.hold) {
                return c.json({ 
                    error: holdResult.message || "Failed to reserve capacity"
                }, 409);
            }

            // Confirm the hold immediately
            const confirmResult = await this.capacityRepo.confirmHold(holdResult.hold.id);
            if (!confirmResult.success) {
                return c.json({ error: confirmResult.message || "Failed to confirm reservation" }, 400);
            }

            // Generate QR code for confirmed reservation
            const qrPayload = createQRPayload(
                reservationId,
                user.id,
                venueMatchId,
                "",
                matchStartTime
            );
            const qrPayloadString = JSON.stringify(qrPayload);

            // Create reservation with CONFIRMED status
            const reservation = await this.reservationRepo.createWithQR(
                reservationId,
                user.id, 
                venueMatchId, 
                partySize, 
                specialRequests || "",
                qrPayloadString
            );

            if (!reservation) {
                await this.capacityRepo.releaseReservedCapacity(venueMatchId, partySize);
                return c.json({ error: "Failed to create reservation" }, 500);
            }

            const qrCodeImage = await generateQRCodeImage(qrPayload);

            return c.json({
                message: "Reservation confirmed! Show this QR code at the venue.",
                reservation: {
                    id: reservation.id,
                    status: 'CONFIRMED',
                    partySize,
                    venueMatchId,
                    venue: venueMatch.venue?.name,
                    match: venueMatch.match ? {
                        scheduledAt: venueMatch.match.scheduled_at
                    } : null
                },
                qr_code: qrCodeImage
            }, 201);
        } else {
            // REQUEST mode: Create reservation as PENDING
            // No capacity hold yet - venue owner will confirm
            const reservation = await this.reservationRepo.createPending(
                reservationId,
                user.id,
                venueMatchId,
                partySize,
                specialRequests || "",
                requiresAccessibility ?? false
            );

            if (!reservation) {
                return c.json({ error: "Failed to create reservation request" }, 500);
            }

            // TODO: Notify venue owner of new reservation request

            return c.json({
                message: "Reservation request submitted. The venue will confirm shortly.",
                reservation: {
                    id: reservation.id,
                    status: 'PENDING',
                    partySize,
                    venueMatchId,
                    venue: venueMatch.venue?.name,
                    match: venueMatch.match ? {
                        scheduledAt: venueMatch.match.scheduled_at
                    } : null
                }
            }, 201);
        }
    });

    /**
     * 4. List User Reservations
     */
    readonly list = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const reservations = await this.reservationRepo.findByUserId(user.id);

        return c.json({
            data: reservations
        });
    });

    /**
     * 4. Get Single Reservation
     */
    readonly getById = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const reservationId = c.req.param('reservationId');
        if (!reservationId) return c.json({ error: "Reservation ID required" }, 400);

        const reservation = await this.reservationRepo.findById(reservationId);

        if (!reservation) {
            return c.json({ error: "Reservation not found" }, 404);
        }

        if (reservation.user_id !== user.id) {
            return c.json({ error: "Forbidden" }, 403);
        }

        // Generate QR image from stored payload
        let qrCodeImage = null;
        if (reservation.qr_code) {
            try {
                const payload = JSON.parse(reservation.qr_code);
                qrCodeImage = await generateQRCodeImage(payload);
            } catch {
                // If parsing fails, qr_code might be legacy format
                qrCodeImage = reservation.qr_code;
            }
        }

        return c.json({
            reservation,
            qrCode: qrCodeImage
        });
    });

    /**
     * 5. Cancel Reservation
     */
    readonly cancel = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = CancelReservationSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const reservationId = c.req.param('reservationId');
        if (!reservationId) return c.json({ error: "Reservation ID required" }, 400);

        const { reason } = c.req.valid('json');

        const canceled = await this.reservationRepo.cancel(reservationId, user.id, reason);

        if (!canceled) {
            return c.json({ error: "Reservation not found or cannot be canceled" }, 404);
        }

        // Release the capacity back to available
        if (canceled.venue_match_id && canceled.party_size) {
            await this.capacityRepo.releaseReservedCapacity(
                canceled.venue_match_id, 
                canceled.party_size
            );
        }

        // TODO: Notify next person in waitlist that space is available

        return c.json({
            message: "Reservation canceled successfully",
            reservation: canceled
        });
    });

    /**
     * 6. Join Waitlist (when no tables available)
     */
    readonly joinWaitlist = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = HoldTableSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const { venueMatchId, partySize, requiresAccessibility } = c.req.valid('json');

        const result = await this.waitlistRepo.addToWaitlist(
            user.id,
            venueMatchId,
            partySize,
            requiresAccessibility ?? false
        );

        if (!result.entry) {
            return c.json({ error: "Failed to add to waitlist" }, 500);
        }

        const position = await this.waitlistRepo.getPosition(result.entry.id);

        if (result.alreadyInQueue) {
            return c.json({
                message: "You're already on the waitlist",
                waitlistId: result.entry.id,
                position
            });
        }

        return c.json({
            message: "Added to waitlist. We'll notify you when a table becomes available.",
            waitlistId: result.entry.id,
            position
        });
    });

    /**
     * 7. Leave Waitlist
     */
    readonly leaveWaitlist = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const waitlistId = c.req.param('waitlistId');
        if (!waitlistId) return c.json({ error: "Waitlist ID required" }, 400);

        const removed = await this.waitlistRepo.removeFromWaitlist(waitlistId, user.id);

        if (!removed) {
            return c.json({ error: "Waitlist entry not found" }, 404);
        }

        return c.json({ message: "Removed from waitlist" });
    });

    /**
     * 8. Get User's Waitlist Entries
     */
    readonly getWaitlist = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const entries = await this.waitlistRepo.findByUserId(user.id);

        // Add position to each entry
        const withPositions = await Promise.all(entries.map(async (entry) => ({
            ...entry,
            position: await this.waitlistRepo.getPosition(entry.id)
        })));

        return c.json({ data: withPositions });
    });

    // =============================================
    // VENUE OWNER ENDPOINTS
    // =============================================

    /**
     * 9. Verify QR Code (Venue Owner scans user's QR)
     * This is the core check-in functionality
     */
    readonly verifyQR = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = VerifyQRSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        // TODO: Verify user is venue owner of this venue
        const { qrContent } = c.req.valid('json');

        // Parse QR content
        const payload = parseQRContent(qrContent);
        if (!payload) {
            return c.json({ 
                valid: false, 
                error: "Invalid QR code format" 
            }, 400);
        }

        // Verify signature and expiry
        const verification = verifyQRPayload(payload);
        if (!verification.valid) {
            return c.json({ 
                valid: false, 
                error: verification.error 
            }, 400);
        }

        // Find the reservation
        const reservation = await this.reservationRepo.findById(payload.rid);
        if (!reservation) {
            return c.json({ 
                valid: false, 
                error: "Reservation not found" 
            }, 404);
        }

        // Check reservation status
        if (reservation.status === 'checked_in') {
            return c.json({
                valid: true,
                alreadyCheckedIn: true,
                message: "This reservation has already been checked in",
                reservation: {
                    id: reservation.id,
                    partySize: reservation.party_size,
                    table: reservation.table,
                    checkedInAt: reservation.checked_in_at
                }
            });
        }

        if (reservation.status !== 'confirmed') {
            return c.json({ 
                valid: false, 
                error: `Reservation status is '${reservation.status}', cannot check in` 
            }, 400);
        }

        return c.json({
            valid: true,
            message: "QR code verified! Ready to check in.",
            reservation: {
                id: reservation.id,
                partySize: reservation.party_size,
                userName: reservation.user_id // Could fetch user name
            }
        });
    });

    /**
     * 10. Check-in Reservation (after QR verification)
     */
    readonly checkIn = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        // TODO: Verify user is venue owner
        const reservationId = c.req.param('reservationId');
        if (!reservationId) return c.json({ error: "Reservation ID required" }, 400);

        const checkedIn = await this.reservationRepo.checkIn(reservationId);

        if (!checkedIn) {
            return c.json({ error: "Reservation not found or already checked in" }, 404);
        }

        return c.json({
            message: "Guest checked in successfully!",
            reservation: checkedIn
        });
    });

    /**
     * 11. Get Venue's Reservations for a Match (Venue Owner)
     */
    readonly getVenueReservations = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        // TODO: Verify user is venue owner
        const venueMatchId = c.req.param('venueMatchId');
        if (!venueMatchId) return c.json({ error: "Venue Match ID required" }, 400);

        const reservations = await this.reservationRepo.findByVenueMatchId(venueMatchId);

        const stats = {
            total: reservations.length,
            checkedIn: reservations.filter(r => r.status === 'checked_in').length,
            pending: reservations.filter(r => r.status === 'confirmed').length,
            totalGuests: reservations.reduce((sum, r) => sum + (r.party_size || 0), 0)
        };

        return c.json({
            reservations,
            stats
        });
    });
}

export default ReservationsController;
