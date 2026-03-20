import { db } from "../config/config.db";
import { reservationsTable } from "../config/db/reservations.table";
import { tablesTable } from "../config/db/tables.table";
import { venuesTable } from "../config/db/venues.table";
import { usersTable } from "../config/db/user.table";
import { venueMatchesTable } from "../config/db/matches.table";
import { eq, and, inArray, lte } from "drizzle-orm";

export class ReservationRepository {

    /**
     * Create reservation with QR code (preferred method)
     * Generates ID upfront to include in QR payload
     */
    async createWithQR(
        reservationId: string,
        userId: string,
        venueMatchId: string,
        partySize: number,
        specialRequests: string,
        qrCode: string,
        commissionRate?: string,
    ) {
        const [reservation] = await db.insert(reservationsTable).values({
            id: reservationId,
            user_id: userId,
            venue_match_id: venueMatchId,
            table_id: null,
            party_size: partySize,
            status: 'confirmed',
            seat_ids: [], // Legacy field
            quantity: partySize,
            special_requests: specialRequests || null,
            qr_code: qrCode,
            reservation_ref: reservationId.slice(0, 8).toUpperCase(),
            commission_rate: commissionRate,
        }).returning();

        return reservation;
    }

    /**
     * Create reservation with PENDING status (for REQUEST booking mode)
     * No QR code generated until venue owner confirms
     */
    async createPending(
        reservationId: string,
        userId: string,
        venueMatchId: string,
        partySize: number,
        specialRequests: string,
        requiresAccessibility: boolean,
        commissionRate?: string,
    ) {
        const [reservation] = await db.insert(reservationsTable).values({
            id: reservationId,
            user_id: userId,
            venue_match_id: venueMatchId,
            table_id: null,
            party_size: partySize,
            status: 'pending',
            seat_ids: [],
            quantity: partySize,
            special_requests: specialRequests || null,
            qr_code: null, // No QR until confirmed by venue
            reservation_ref: reservationId.slice(0, 8).toUpperCase(),
            commission_rate: commissionRate,
        }).returning();

        return reservation;
    }

    /**
     * Create reservation from a confirmed hold (legacy)
     * Note: table_id is optional - capacity-based system doesn't use physical tables
     */
    async createFromHold(
        userId: string,
        tableId: string | null,
        venueMatchId: string,
        partySize: number,
        specialRequests: string = "",
    ) {
        const [reservation] = await db.insert(reservationsTable).values({
            user_id: userId,
            venue_match_id: venueMatchId,
            table_id: tableId,
            party_size: partySize,
            status: 'confirmed',
            seat_ids: [], // Legacy field
            quantity: partySize,
            special_requests: specialRequests || null,
            qr_code: crypto.randomUUID(), // Unique placeholder
        }).returning();

        return reservation;
    }
  
    /**
     * Find reservation by ID
     * Note: Excludes venue.location (PostGIS geometry) to avoid parsing issues
     */
    async findById(reservationId: string) {
        return await db.query.reservationsTable.findFirst({
            where: eq(reservationsTable.id, reservationId),
            with: {
                table: true,
                venueMatch: {
                    with: {
                        venue: {
                            columns: {
                                id: true,
                                name: true,
                                city: true,
                                street_address: true,
                                phone: true,
                                owner_id: true,
                                is_active: true,
                                status: true,
                            },
                        },
                        match: {
                            with: {
                                homeTeam: true,
                                awayTeam: true,
                            },
                        },
                    },
                },
            },
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
                        venue: {
                            columns: {
                                id: true,
                                name: true,
                                city: true,
                                street_address: true,
                            },
                        },
                        match: {
                            with: {
                                homeTeam: true,
                                awayTeam: true,
                            },
                        },
                    },
                },
            },
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
                        venue: {
                            columns: {
                                id: true,
                                name: true,
                                city: true,
                                street_address: true,
                            },
                        },
                        match: {
                            with: {
                                homeTeam: true,
                                awayTeam: true,
                            },
                        },
                    },
                },
            },
            orderBy: (reservations, { desc }) => [desc(reservations.created_at)],
        });
    }

    /**
     * Find all reservations for a venue match (for venue owner)
     */
    async findByVenueMatchId(venueMatchId: string) {
        return await db.query.reservationsTable.findMany({
            where: and(
                eq(reservationsTable.venue_match_id, venueMatchId),
                inArray(reservationsTable.status, ['confirmed', 'checked_in']),
            ),
            with: {
                table: true,
            },
            orderBy: (reservations, { asc }) => [asc(reservations.created_at)],
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
                updated_at: new Date(),
            })
            .where(and(
                eq(reservationsTable.id, reservationId),
                eq(reservationsTable.status, 'confirmed'),
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
                updated_at: new Date(),
            })
            .where(and(
                eq(reservationsTable.id, reservationId),
                eq(reservationsTable.user_id, userId),
                inArray(reservationsTable.status, ['pending', 'confirmed']),
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
                updated_at: new Date(),
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
                updated_at: new Date(),
            })
            .where(eq(reservationsTable.id, reservationId))
            .returning();

        return updated;
    }
    
    async updateReservationqrCode(reservationId: string, qrCodeContent: string) {
        const [updated] = await db.update(reservationsTable)
            .set({
                qr_code: qrCodeContent,
                updated_at: new Date(),
            })
            .where(eq(reservationsTable.id, reservationId))
            .returning();

        return updated;
    }

    /**
     * Get all checked-in reservations that haven't been billed yet, grouped by venue owner.
     */
    async getUnbilledCheckedInReservations() {
        // Join with venues/users to retrieve owner and Stripe customer.
        return await db.select({
            reservation_id: reservationsTable.id,
            venue_id: venueMatchesTable.venue_id,
            owner_id: venuesTable.owner_id,
            party_size: reservationsTable.party_size,
            commission_rate: reservationsTable.commission_rate,
            stripe_customer_id: usersTable.stripe_customer_id,
        })
        .from(reservationsTable)
        .innerJoin(venueMatchesTable, eq(reservationsTable.venue_match_id, venueMatchesTable.id))
        .innerJoin(venuesTable, eq(venueMatchesTable.venue_id, venuesTable.id))
        .innerJoin(usersTable, eq(venuesTable.owner_id, usersTable.id))
        .where(and(
            eq(reservationsTable.status, 'checked_in'),
            eq(reservationsTable.is_billed, false),
        ));
    }

    /**
     * Mark multiple reservations as billed.
     */
    async markAsBilled(reservationIds: string[]) {
        if (reservationIds.length === 0) return;

        return await db.update(reservationsTable)
            .set({
                is_billed: true,
                billed_at: new Date(),
                updated_at: new Date(),
            })
            .where(inArray(reservationsTable.id, reservationIds))
            .returning();
    }

    async getUnbilledCheckedInReservationIdsByOwner(ownerId: string, checkedInAtOrBefore?: Date) {
        const conditions = [
            eq(venuesTable.owner_id, ownerId),
            eq(reservationsTable.status, "checked_in"),
            eq(reservationsTable.is_billed, false),
        ];

        if (checkedInAtOrBefore) {
            conditions.push(lte(reservationsTable.checked_in_at, checkedInAtOrBefore));
        }

        const rows = await db.select({
            id: reservationsTable.id,
        })
            .from(reservationsTable)
            .innerJoin(venueMatchesTable, eq(reservationsTable.venue_match_id, venueMatchesTable.id))
            .innerJoin(venuesTable, eq(venueMatchesTable.venue_id, venuesTable.id))
            .where(and(...conditions));

        return rows.map((row) => row.id);
    }

    async getVenueIdsByReservationIds(reservationIds: string[]) {
        if (reservationIds.length === 0) {
            return new Map<string, string>();
        }

        const rows = await db.select({
            reservation_id: reservationsTable.id,
            venue_id: venueMatchesTable.venue_id,
        })
            .from(reservationsTable)
            .innerJoin(venueMatchesTable, eq(reservationsTable.venue_match_id, venueMatchesTable.id))
            .where(inArray(reservationsTable.id, reservationIds));

        const mapping = new Map<string, string>();
        for (const row of rows) {
            mapping.set(row.reservation_id, row.venue_id);
        }

        return mapping;
    }

    async getBillingDetailsByReservationIds(reservationIds: string[]) {
        if (reservationIds.length === 0) {
            return [];
        }

        const rows = await db.select({
            reservation_id: reservationsTable.id,
            party_size: reservationsTable.party_size,
            commission_rate: reservationsTable.commission_rate,
            checked_in_at: reservationsTable.checked_in_at,
            created_at: reservationsTable.created_at,
            venue_name: venuesTable.name,
        })
            .from(reservationsTable)
            .innerJoin(venueMatchesTable, eq(reservationsTable.venue_match_id, venueMatchesTable.id))
            .innerJoin(venuesTable, eq(venueMatchesTable.venue_id, venuesTable.id))
            .where(inArray(reservationsTable.id, reservationIds));

        const orderByReservationId = new Map<string, number>();
        reservationIds.forEach((id, index) => orderByReservationId.set(id, index));

        return rows.sort((a, b) => {
            const aIndex = orderByReservationId.get(a.reservation_id) ?? Number.MAX_SAFE_INTEGER;
            const bIndex = orderByReservationId.get(b.reservation_id) ?? Number.MAX_SAFE_INTEGER;
            return aIndex - bIndex;
        });
    }
}
