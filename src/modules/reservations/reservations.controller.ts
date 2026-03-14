import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { z } from "zod";
import type { HonoEnv } from "../../types/hono.types";
import { HoldTableSchema, ConfirmReservationSchema, CancelReservationSchema, VerifyQRSchema } from "../../utils/reservation.valid";
import { ReservationsLogic } from "./reservations.logic";

class ReservationsController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly reservationsLogic: ReservationsLogic) {}

    /**
     * 1. Create Reservation
     */
    public readonly create = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = HoldTableSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        try {
            const body = c.req.valid('json');
            const result = await this.reservationsLogic.create(user.id, user.email, user.firstName || 'User', body);
            
            // If the logic returned an object with a reservation object, infer 201 status
            if (result.reservation) {
                return c.json(result, 201);
            }
            return c.json(result, 201);

        } catch (error: any) {
            if (error.message === "VENUE_MATCH_NOT_FOUND") return c.json({ error: "Venue match not found" }, 404);
            if (error.message === "NO_CAPACITY") return c.json({ error: "No capacity available" }, 409);
            if (error.message === "VENUE_INACTIVE_PAYMENT_REQUIRED") {
                return c.json({
                    error: "VENUE_INACTIVE_PAYMENT_REQUIRED",
                    message: "Venue is inactive until a valid payment method is configured.",
                }, 403);
            }
            console.error("Create reservation error:", error);
            return c.json({ error: error.message || "Failed to create reservation" }, 500);
        }
    });

    /**
     * 4. List User Reservations
     */
    readonly list = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        try {
            const reservations = await this.reservationsLogic.list(user.id);
            return c.json({ data: reservations });
        } catch (error: any) {
            console.error("List reservations error:", error);
            return c.json({ error: "Failed to list reservations" }, 500);
        }
    });

    /**
     * 4. Get Single Reservation
     */
    readonly getById = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const reservationId = c.req.param('reservationId');
        if (!reservationId) return c.json({ error: "Reservation ID required" }, 400);

        try {
            const result = await this.reservationsLogic.getById(user.id, reservationId);
            return c.json(result);
        } catch (error: any) {
            if (error.message === "RESERVATION_NOT_FOUND") return c.json({ error: "Reservation not found" }, 404);
            if (error.message === "FORBIDDEN") return c.json({ error: "Forbidden" }, 403);
            console.error("Get reservation error:", error);
            return c.json({ error: "Failed to get reservation" }, 500);
        }
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

        try {
            const { reason } = c.req.valid('json');
            const result = await this.reservationsLogic.cancel(user.id, reservationId, reason);
            return c.json(result);
        } catch (error: any) {
            if (error.message === "RESERVATION_NOT_FOUND_OR_CANNOT_CANCEL") return c.json({ error: "Reservation not found or cannot be canceled" }, 404);
            console.error("Cancel reservation error:", error);
            return c.json({ error: "Failed to cancel reservation" }, 500);
        }
    });

    /**
     * 6. Join Waitlist
     */
    readonly joinWaitlist = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = HoldTableSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        try {
            const body = c.req.valid('json');
            const result = await this.reservationsLogic.joinWaitlist(user.id, body);
            return c.json(result);
        } catch (error: any) {
            console.error("Join waitlist error:", error);
            return c.json({ error: error.message || "Failed to join waitlist" }, 500);
        }
    });

    /**
     * 7. Leave Waitlist
     */
    readonly leaveWaitlist = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const waitlistId = c.req.param('waitlistId');
        if (!waitlistId) return c.json({ error: "Waitlist ID required" }, 400);

        try {
            const result = await this.reservationsLogic.leaveWaitlist(user.id, waitlistId);
            return c.json(result);
        } catch (error: any) {
            if (error.message === "WAITLIST_ENTRY_NOT_FOUND") return c.json({ error: "Waitlist entry not found" }, 404);
            console.error("Leave waitlist error:", error);
            return c.json({ error: "Failed to leave waitlist" }, 500);
        }
    });

    /**
     * 8. Get User's Waitlist Entries
     */
    readonly getWaitlist = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        try {
            const entries = await this.reservationsLogic.getWaitlist(user.id);
            return c.json({ data: entries });
        } catch (error: any) {
            console.error("Get waitlist error:", error);
            return c.json({ error: "Failed to get waitlist" }, 500);
        }
    });

    // =============================================
    // VENUE OWNER ENDPOINTS
    // =============================================

    /**
     * 9. Verify QR Code
     */
    readonly verifyQR = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = VerifyQRSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        try {
            const { qrContent } = c.req.valid('json');
            const result = await this.reservationsLogic.verifyQR(user.id, qrContent);
            return c.json(result);
        } catch (error: any) {
            if (error.message === "INVALID_QR_FORMAT") return c.json({ valid: false, error: "Invalid QR code format" }, 400);
            if (error.message === "INVALID_QR") return c.json({ valid: false, error: "Invalid or expired QR code" }, 400);
            if (error.message === "RESERVATION_NOT_FOUND") return c.json({ valid: false, error: "Reservation not found" }, 404);
            if (error.message === "VENUE_INACTIVE_PAYMENT_REQUIRED") {
                return c.json({
                    error: "VENUE_INACTIVE_PAYMENT_REQUIRED",
                    message: "Venue is inactive until a valid payment method is configured.",
                }, 403);
            }
            if (error.message?.startsWith("RESERVATION_STATUS")) return c.json({ valid: false, error: `Invalid status: ${error.message}` }, 400);
            
            console.error("Verify QR error:", error);
            return c.json({ error: "Failed to verify QR" }, 500);
        }
    });

    /**
     * 10. Check-in Reservation
     */
    readonly checkIn = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const reservationId = c.req.param('reservationId');
        if (!reservationId) return c.json({ error: "Reservation ID required" }, 400);

        try {
            const result = await this.reservationsLogic.checkIn(user.id, reservationId);
            return c.json(result);
        } catch (error: any) {
            if (error.message === "RESERVATION_NOT_FOUND_OR_CHECKED_IN") return c.json({ error: "Reservation not found or already checked in" }, 404);
            if (error.message === "VENUE_INACTIVE_PAYMENT_REQUIRED") {
                return c.json({
                    error: "VENUE_INACTIVE_PAYMENT_REQUIRED",
                    message: "Venue is inactive until a valid payment method is configured.",
                }, 403);
            }
            console.error("Check-in error:", error);
            return c.json({ error: "Failed to check in" }, 500);
        }
    });

    /**
     * 11. Get Venue's Reservations
     */
    readonly getVenueReservations = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const venueMatchId = c.req.param('venueMatchId');
        if (!venueMatchId) return c.json({ error: "Venue Match ID required" }, 400);

        try {
            const result = await this.reservationsLogic.getVenueReservations(user.id, venueMatchId);
            return c.json(result);
        } catch (error: any) {
            console.error("Get venue reservations error:", error);
            return c.json({ error: "Failed to get venue reservations" }, 500);
        }
    });
}

export default ReservationsController;
