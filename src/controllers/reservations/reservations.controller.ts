import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import type { HonoEnv } from "../../types/hono.types";
import { TableRepository } from "../../repository/table.repository";
import { ReservationRepository } from "../../repository/reservation.repository";
import { HoldTableSchema, ConfirmReservationSchema } from "../../utils/reservation.valid";
import QRCode from "qrcode";

class ReservationsController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly tableRepo = new TableRepository();
    private readonly reservationRepo = new ReservationRepository();

    // 1. Hold Table (Best Fit)
    readonly holdTable = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = HoldTableSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const { venueMatchId, partySize, requiresAccessibility } = c.req.valid('json');

        // New signature: matchId, partySize, accessible
        const table = await this.tableRepo.findBestAvailableTable(venueMatchId, partySize, requiresAccessibility);

        if (!table) {
            return c.json({ error: "No available tables for this party size." }, 409);
        }

        const hold = await this.tableRepo.createHold(user.id, venueMatchId, table.id, partySize);

        if (!hold) {
            return c.json({ error: "Failed to create hold" }, 500);
        }

        return c.json({
            message: "Table held for 15 minutes",
            holdId: hold.id,
            expiresAt: hold.expires_at,
            table: {
                name: table.name,
                capacity: table.capacity
            }
        });
    });

    // 2. Confirm Reservation
    readonly confirmReservation = this.factory.createHandlers(validator('json', (value, c) => {
        const parsed = ConfirmReservationSchema.safeParse(value);
        if (!parsed.success) return c.json({ error: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const { holdId } = c.req.valid('json');

        const hold = await this.tableRepo.findHoldById(holdId);

        if (!hold) {
            return c.json({ error: "Hold not found or expired" }, 404);
        }

        if (hold.user_id !== user.id) {
            return c.json({ error: "Forbidden" }, 403);
        }

        // Extra expiry check (though repo usually filters it, explicitly good practice)
        if (new Date() > new Date(hold.expires_at)) {
            return c.json({ error: "Hold expired" }, 400);
        }

        // Generate QR Code Data URL
        const qrData = JSON.stringify({
            op: "check-in",
            mid: hold.venue_match_id,
            tid: hold.table_id,
            uid: user.id
        });
        const qrCodeDataUrl = await QRCode.toDataURL(qrData);

        // Create Reservation
        // NOTE: Updating repo to accept QR URL in a separate step or I'll just pass it if I updated the method signature.
        // Looking at ReservationRepository written earlier: `createFromHold` DOES NOT take qrString as arg.
        // It generates a dummy internal one. 
        // I should stick to the simple path: Allow repo to handle it, or update repo.
        // I will use `update` to set the QR code field or pass it if I can edit the repo later.
        // For now, let's assume `createFromHold` sets a temporary one, and I could update it?
        // Actually, best to fix `createFromHold` signature in next tool call or assume it's "good enough" for prototype if it saves *something*.
        // But user asked for specific "generation...".
        // I will let `createFromHold` do its thing (it saves a hardcoded URL currently).
        // I will return the REAL QR code in the response so the frontend can display it.
        // Saving the image URL to DB is tricky without file upload. 
        // Typically we save the *content* and generate QR on fly, or save base64. 
        // Db field is `varchar(255)`, base64 is too long.
        // So I should only save the *content* string in DB, and frontend generates QR?
        // OR save a short internal ID/URL.
        // `reservationsTable` has `qr_code` varchar 255.
        // I will save the `qrData` string there.
        // And return the `qrCodeDataUrl` (image) to client.

        // I need to update `ReservationRepository` to accept the QR string.
        // I'll do that in next step.

        const reservation = await this.reservationRepo.createFromHold(
            hold.id, user.id, hold.table_id, hold.venue_match_id, hold.party_size, qrData
        );

        if (!reservation) {
            return c.json({ error: "Failed to create reservation" }, 500);
        }

        // Delete hold
        await this.tableRepo.deleteHold(hold.id);

        return c.json({
            message: "Reservation confirmed",
            reservationId: reservation.id,
            qrCode: qrCodeDataUrl, // The Base64 image for the UI
            tableName: hold.table.name
        });
    });

    // 3. List User Reservations
    readonly list = this.factory.createHandlers(async (c) => {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

        const reservations = await this.reservationRepo.findByUserId(user.id);

        // Enhance with QR Code Image
        const data = await Promise.all(reservations.map(async (res) => {
            let qrImage = null;
            if (res.qr_code) {
                try {
                    qrImage = await QRCode.toDataURL(res.qr_code);
                } catch (e) {
                    console.error("Failed to gen QR", e);
                }
            }
            return {
                ...res,
                qrCodeImage: qrImage
            };
        }));

        return c.json({
            data: data
        });
    });
}

export default ReservationsController;
