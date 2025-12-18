import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import type { HonoEnv } from "../../types/hono.types";
import { TableRepository } from "../../repository/table.repository";
import { ReservationRepository } from "../../repository/reservation.repository";
import { WaitlistRepository } from "../../repository/waitlist.repository";
import { HoldTableSchema, ConfirmReservationSchema, CancelReservationSchema, VerifyQRSchema } from "../../utils/reservation.valid";
import { createQRPayload, generateQRCodeImage, parseQRContent, verifyQRPayload } from "../../utils/qr.utils";

class ReservationsController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly tableRepo = new TableRepository();
    private readonly reservationRepo = new ReservationRepository();
    private readonly waitlistRepo = new WaitlistRepository();

    /**
     * 1. Hold Table (Atomic - handles concurrent requests safely)
     * Uses database transaction with FOR UPDATE SKIP LOCKED to prevent race conditions
     */
    readonly holdTable = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = HoldTableSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const { venueMatchId, partySize, requiresAccessibility } = c.req.valid('json');

        // Use ATOMIC findAndHold to prevent race conditions
        const result = await this.tableRepo.findAndHoldBestTable(
            venueMatchId, 
            partySize, 
            user.id, 
            requiresAccessibility ?? false
        );

        if (!result || !result.hold || !result.table) {
            // No tables available - offer to join waitlist
            return c.json({ 
                error: "No available tables for this party size.",
                canJoinWaitlist: true,
                message: "Would you like to join the waitlist? You'll be notified when a table becomes available."
            }, 409);
        }

        const { hold, table } = result;

        return c.json({
            message: "Table held for 15 minutes. Please confirm your reservation.",
            holdId: hold.id,
            expiresAt: hold.expires_at,
            table: {
                id: table.id,
                name: table.name,
                capacity: table.capacity
            }
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

        const hold = await this.tableRepo.findHoldById(holdId);

        if (!hold) {
            return c.json({ error: "Hold not found or expired" }, 404);
        }

        if (hold.user_id !== user.id) {
            return c.json({ error: "Forbidden" }, 403);
        }

        if (new Date() > new Date(hold.expires_at)) {
            await this.tableRepo.deleteHold(hold.id);
            return c.json({ error: "Hold expired. Please try again." }, 400);
        }

        // Get match info for QR expiry (default to 24h from now if not available)
        // Note: venueMatch relation may not include match details depending on query
        const matchStartTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Create reservation first to get the ID
        const reservation = await this.reservationRepo.createFromHold(
            user.id, 
            hold.table_id, 
            hold.venue_match_id, 
            hold.party_size, 
            "" // Placeholder, will update with signed QR
        );

        if (!reservation) {
            return c.json({ error: "Failed to create reservation" }, 500);
        }

        // Generate signed QR code payload
        const qrPayload = createQRPayload(
            reservation.id,
            user.id,
            hold.venue_match_id,
            hold.table_id,
            matchStartTime
        );

        // Generate QR code image
        const qrCodeImage = await generateQRCodeImage(qrPayload);

        // Delete hold (table is now reserved)
        await this.tableRepo.deleteHold(hold.id);

        return c.json({
            message: "Reservation confirmed! Show this QR code at the venue.",
            reservation: {
                id: reservation.id,
                status: reservation.status,
                partySize: reservation.party_size,
                table: hold.table
            },
            qrCode: qrCodeImage
        });
    });

    /**
     * 3. List User Reservations
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

        // Regenerate QR code for display
        const matchStartTime = reservation.venueMatch?.match?.scheduled_at
            ? new Date(reservation.venueMatch.match.scheduled_at)
            : new Date();

        const qrPayload = createQRPayload(
            reservation.id,
            user.id,
            reservation.venue_match_id,
            reservation.table_id || '',
            matchStartTime
        );
        const qrCodeImage = await generateQRCodeImage(qrPayload);

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

        // TODO: Notify next person in waitlist that a table is available
        // This would be done via a background job or here directly

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
                table: reservation.table,
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
