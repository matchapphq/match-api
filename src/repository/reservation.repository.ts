import { db } from "../config/config.db";
import { reservationsTable } from "../config/db/reservations.table";
import { tablesTable } from "../config/db/tables.table";
import { venueMatchesTable } from "../config/db/matches.table";
import { eq, and, inArray } from "drizzle-orm";

export class ReservationRepository {

    /**
     * Create reservation from a confirmed hold
     */
    async createFromHold(
        userId: string,
        tableId: string,
        matchId: string,
        partySize: number,
        qrCodeContent: string
    ) {
        const [reservation] = await db.insert(reservationsTable).values({
            user_id: userId,
            venue_match_id: matchId,
            table_id: tableId,
            party_size: partySize,
            status: 'confirmed',
            seat_ids: [], // Legacy field
            quantity: 1,
            qr_code: qrCodeContent
        }).returning();

        return reservation;
    }

    /**
     * Find reservation by ID
     */
    async findById(reservationId: string) {
        return await db.query.reservationsTable.findFirst({
            where: eq(reservationsTable.id, reservationId),
            with: {
                table: true,
                venueMatch: {
                    with: {
                        venue: true,
                        match: true
                    }
                }
            }
        });
    }

    /**
     * Find reservation by QR code content
     */
    async findByQRCode(qrCode: string) {
        return await db.query.reservationsTable.findFirst({
            where: eq(reservationsTable.qr_code, qrCode),
            with: {
                table: true,
                venueMatch: {
                    with: {
                        venue: true,
                        match: true
                    }
                }
            }
        });
    }

    /**
     * Find all reservations for a user
     */
    async findByUserId(userId: string) {
        return await db.query.reservationsTable.findMany({
            where: eq(reservationsTable.user_id, userId),
            with: {
                table: true,
                venueMatch: {
                    with: {
                        venue: true,
                        match: true
                    }
                }
            },
            orderBy: (reservations, { desc }) => [desc(reservations.created_at)]
        });
    }

    /**
     * Find all reservations for a venue match (for venue owner)
     */
    async findByVenueMatchId(venueMatchId: string) {
        return await db.query.reservationsTable.findMany({
            where: and(
                eq(reservationsTable.venue_match_id, venueMatchId),
                inArray(reservationsTable.status, ['confirmed', 'checked_in'])
            ),
            with: {
                table: true
            },
            orderBy: (reservations, { asc }) => [asc(reservations.created_at)]
        });
    }

    /**
     * Check-in a reservation (venue owner scans QR)
     */
    async checkIn(reservationId: string) {
        const [updated] = await db.update(reservationsTable)
            .set({
                status: 'checked_in',
                checked_in_at: new Date(),
                updated_at: new Date()
            })
            .where(and(
                eq(reservationsTable.id, reservationId),
                eq(reservationsTable.status, 'confirmed')
            ))
            .returning();

        return updated;
    }

    /**
     * Cancel a reservation
     */
    async cancel(reservationId: string, userId: string, reason?: string) {
        const [updated] = await db.update(reservationsTable)
            .set({
                status: 'canceled',
                canceled_at: new Date(),
                canceled_reason: reason,
                updated_at: new Date()
            })
            .where(and(
                eq(reservationsTable.id, reservationId),
                eq(reservationsTable.user_id, userId),
                inArray(reservationsTable.status, ['pending', 'confirmed'])
            ))
            .returning();

        return updated;
    }

    /**
     * Complete a reservation (after match ends)
     */
    async complete(reservationId: string) {
        const [updated] = await db.update(reservationsTable)
            .set({
                status: 'completed',
                completed_at: new Date(),
                updated_at: new Date()
            })
            .where(eq(reservationsTable.id, reservationId))
            .returning();

        return updated;
    }

    /**
     * Update reservation status
     */
    async updateStatus(reservationId: string, status: 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'canceled' | 'no_show') {
        const [updated] = await db.update(reservationsTable)
            .set({
                status,
                updated_at: new Date()
            })
            .where(eq(reservationsTable.id, reservationId))
            .returning();

        return updated;
    }
}
