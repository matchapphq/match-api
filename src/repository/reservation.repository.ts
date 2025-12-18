import { db } from "../config/config.db";
import { reservationsTable } from "../config/db/reservations.table";
import { tablesTable } from "../config/db/tables.table";
import { venueMatchesTable } from "../config/db/matches.table"; // Needed for info
import { eq } from "drizzle-orm";
// import QRCode from "qrcode"; // User asked for generic QR generation, will implement mock or simple helper

export class ReservationRepository {

    async createFromHold(
        holdId: string,
        userId: string,
        tableId: string,
        matchId: string,
        partySize: number,
        qrCodeContent: string
    ) {
        // In a real app, we'd fetch match price and calculate total.
        // For now, using placeholders.

        const [reservation] = await db.insert(reservationsTable).values({
            user_id: userId,
            venue_match_id: matchId,
            table_id: tableId,
            party_size: partySize,
            status: 'confirmed',
            seat_ids: [], // No specific seats, just table
            quantity: 1, // 1 table
            qr_code: qrCodeContent
        }).returning();

        return reservation;
    }

    async findByUserId(userId: string) {
        return await db.query.reservationsTable.findMany({
            where: eq(reservationsTable.user_id, userId),
            with: {
                table: true,
                venueMatch: {
                    with: {
                        venue: true
                    }
                }
            },
            orderBy: (reservations, { desc }) => [desc(reservations.created_at)]
        });
    }
}
