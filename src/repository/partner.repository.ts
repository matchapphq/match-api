import { db } from "../config/config.db";
import { venuesTable } from "../config/db/venues.table";
import { venueMatchesTable, matchesTable } from "../config/db/matches.table";
import { reservationsTable } from "../config/db/reservations.table";
import { eq, and, sql, inArray, count, countDistinct, gte, sum } from "drizzle-orm";

export class PartnerRepository {

    /**
     * Get all venues owned by a user
     */
    async getVenuesByOwnerId(ownerId: string) {
        return await db.select()
            .from(venuesTable)
            .where(eq(venuesTable.owner_id, ownerId));
    }

    /**
     * Get venue IDs owned by a user
     */
    async getVenueIdsByOwnerId(ownerId: string): Promise<string[]> {
        const venues = await db.select({ id: venuesTable.id })
            .from(venuesTable)
            .where(eq(venuesTable.owner_id, ownerId));
        return venues.map(v => v.id);
    }

    /**
     * Update a venue's subscription_id
     */
    async updateVenueSubscription(venueId: string, subscriptionId: string) {
        const [updated] = await db.update(venuesTable)
            .set({ subscription_id: subscriptionId })
            .where(eq(venuesTable.id, venueId))
            .returning();
        return updated;
    }

    /**
     * Create a new venue
     */
    async createVenue(data: {
        name: string;
        owner_id: string;
        subscription_id: string;
        street_address: string;
        city: string;
        state_province?: string;
        postal_code: string;
        country: string;
        phone?: string;
        email?: string;
        capacity?: number;
        type?: string;
    }) {
        const [newVenue] = await db.insert(venuesTable).values({
            name: data.name,
            owner_id: data.owner_id,
            subscription_id: data.subscription_id,
            street_address: data.street_address,
            city: data.city,
            state_province: data.state_province || "",
            postal_code: data.postal_code,
            country: data.country,
            location: sql`ST_SetSRID(ST_MakePoint(0, 0), 4326)`,
            latitude: 0,
            longitude: 0,
            type: 'sports_bar',
            status: 'pending',
            is_active: true
        }).returning();

        return newVenue;
    }

    /**
     * Get venue by ID
     */
    async getVenueById(venueId: string) {
        const venues = await db.select()
            .from(venuesTable)
            .where(eq(venuesTable.id, venueId))
            .limit(1);
        return venues[0] || null;
    }

    /**
     * Verify if a user owns a venue
     */
    async verifyVenueOwnership(venueId: string, ownerId: string): Promise<boolean> {
        const venue = await db.select()
            .from(venuesTable)
            .where(and(eq(venuesTable.id, venueId), eq(venuesTable.owner_id, ownerId)))
            .limit(1);
        return venue.length > 0;
    }

    /**
     * Get venue by ID with ownership check
     */
    async getVenueByIdAndOwner(venueId: string, ownerId: string) {
        const venues = await db.select()
            .from(venuesTable)
            .where(and(eq(venuesTable.id, venueId), eq(venuesTable.owner_id, ownerId)))
            .limit(1);
        return venues[0] || null;
    }

    /**
     * Schedule a match at a venue
     */
    async scheduleMatch(venueId: string, matchId: string, totalCapacity: number) {
        const [venueMatch] = await db.insert(venueMatchesTable).values({
            venue_id: venueId,
            match_id: matchId,
            total_capacity: totalCapacity,
            available_capacity: totalCapacity,
            is_active: true
        }).returning();

        return venueMatch;
    }

    /**
     * Cancel a scheduled match at a venue
     * Uses transaction to ensure data consistency when deleting venue match
     */
    async cancelMatch(venueId: string, matchId: string) {
        return await db.transaction(async (tx) => {
            // First get the venue match to check if it exists
            const [venueMatch] = await tx.select({ id: venueMatchesTable.id })
                .from(venueMatchesTable)
                .where(and(
                    eq(venueMatchesTable.venue_id, venueId),
                    eq(venueMatchesTable.match_id, matchId)
                ))
                .limit(1);

            if (!venueMatch) {
                return false;
            }

            // Cancel any pending reservations for this venue match
            await tx.update(reservationsTable)
                .set({ 
                    status: 'canceled',
                    canceled_at: new Date(),
                    canceled_reason: 'Match canceled by venue'
                })
                .where(eq(reservationsTable.venue_match_id, venueMatch.id));

            // Delete the venue match
            await tx.delete(venueMatchesTable)
                .where(eq(venueMatchesTable.id, venueMatch.id));

            return true;
        });
    }

    /**
     * Get all venue matches for given venue IDs with related data
     */
    async getVenueMatchesByVenueIds(venueIds: string[]) {
        if (venueIds.length === 0) return [];

        return await db.query.venueMatchesTable.findMany({
            where: inArray(venueMatchesTable.venue_id, venueIds),
            with: {
                venue: {
                    columns: {
                        id: true,
                        name: true,
                    }
                },
                match: {
                    with: {
                        homeTeam: true,
                        awayTeam: true,
                        league: true,
                    }
                },
                reservations: true,
            },
        });
    }

    /**
     * Get venue match IDs for a venue
     */
    async getVenueMatchIdsByVenueId(venueId: string): Promise<string[]> {
        const venueMatches = await db.select({ id: venueMatchesTable.id })
            .from(venueMatchesTable)
            .where(eq(venueMatchesTable.venue_id, venueId));
        return venueMatches.map(vm => vm.id);
    }

    /**
     * Get reservations with user and match details for given venue match IDs
     */
    async getReservationsByVenueMatchIds(venueMatchIds: string[]) {
        if (venueMatchIds.length === 0) return [];

        return await db.query.reservationsTable.findMany({
            where: inArray(reservationsTable.venue_match_id, venueMatchIds),
            with: {
                user: {
                    columns: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    }
                },
                venueMatch: {
                    with: {
                        match: {
                            with: {
                                homeTeam: true,
                                awayTeam: true,
                            }
                        }
                    }
                }
            },
            orderBy: (reservations, { desc }) => [desc(reservations.created_at)],
        });
    }

    /**
     * Get venue matches with capacity data for given venue IDs
     */
    async getVenueMatchesWithCapacity(venueIds: string[]) {
        if (venueIds.length === 0) return [];

        return await db.select({
            id: venueMatchesTable.id,
            total_capacity: venueMatchesTable.total_capacity,
            reserved_capacity: venueMatchesTable.reserved_capacity,
        })
            .from(venueMatchesTable)
            .where(inArray(venueMatchesTable.venue_id, venueIds));
    }

    /**
     * Get client statistics for given venue match IDs
     */
    async getClientStats(venueMatchIds: string[]) {
        if (venueMatchIds.length === 0) {
            return { uniqueUsers: 0, totalReservations: 0 };
        }

        const stats = await db.select({
            uniqueUsers: countDistinct(reservationsTable.user_id),
            totalReservations: count(reservationsTable.id),
        })
            .from(reservationsTable)
            .where(inArray(reservationsTable.venue_match_id, venueMatchIds));

        return {
            uniqueUsers: Number(stats[0]?.uniqueUsers) || 0,
            totalReservations: Number(stats[0]?.totalReservations) || 0,
        };
    }

    /**
     * Get match statistics (upcoming vs completed) for given venue IDs
     */
    async getMatchStats(venueIds: string[]) {
        if (venueIds.length === 0) return [];

        return await db.select({
            matchId: venueMatchesTable.match_id,
            scheduledAt: matchesTable.scheduled_at,
            status: matchesTable.status,
        })
            .from(venueMatchesTable)
            .innerJoin(matchesTable, eq(venueMatchesTable.match_id, matchesTable.id))
            .where(inArray(venueMatchesTable.venue_id, venueIds));
    }

    /**
     * Get complete analytics summary for a partner
     * Note: neon-http driver doesn't support transactions, using sequential queries
     */
    async getAnalyticsSummary(venueIds: string[]) {
        if (venueIds.length === 0) {
            return {
                venueMatches: [],
                clientStats: { uniqueUsers: 0, totalReservations: 0 },
                matchStats: [],
            };
        }

        // Get venue matches with capacity
        const venueMatches = await db.select({
            id: venueMatchesTable.id,
            total_capacity: venueMatchesTable.total_capacity,
            reserved_capacity: venueMatchesTable.reserved_capacity,
        })
            .from(venueMatchesTable)
            .where(inArray(venueMatchesTable.venue_id, venueIds));

        const vmIds = venueMatches.map(vm => vm.id);

        // Get client statistics
        let clientStats = { uniqueUsers: 0, totalReservations: 0 };
        if (vmIds.length > 0) {
            const stats = await db.select({
                uniqueUsers: countDistinct(reservationsTable.user_id),
                totalReservations: count(reservationsTable.id),
            })
                .from(reservationsTable)
                .where(inArray(reservationsTable.venue_match_id, vmIds));

            clientStats = {
                uniqueUsers: Number(stats[0]?.uniqueUsers) || 0,
                totalReservations: Number(stats[0]?.totalReservations) || 0,
            };
        }

        // Get match statistics
        const matchStats = await db.select({
            matchId: venueMatchesTable.match_id,
            scheduledAt: matchesTable.scheduled_at,
            status: matchesTable.status,
        })
            .from(venueMatchesTable)
            .innerJoin(matchesTable, eq(venueMatchesTable.match_id, matchesTable.id))
            .where(inArray(venueMatchesTable.venue_id, venueIds));

        return {
            venueMatches,
            clientStats,
            matchStats,
        };
    }

    /**
     * Get venue clients data in a single transaction
     * Combines ownership verification and data fetching
     */
    /**
     * Get customer count for last 30 days for given venue IDs
     */
    async getCustomerCountLast30Days(venueIds: string[]) {
        if (venueIds.length === 0) {
            return { customerCount: 0, totalGuests: 0, totalReservations: 0 };
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get venue match IDs for these venues (no transaction needed)
        const venueMatches = await db.select({ id: venueMatchesTable.id })
            .from(venueMatchesTable)
            .where(inArray(venueMatchesTable.venue_id, venueIds));

        if (venueMatches.length === 0) {
            return { customerCount: 0, totalGuests: 0, totalReservations: 0 };
        }

        const vmIds = venueMatches.map(vm => vm.id);

        // Count unique customers and total guests in last 30 days
        const stats = await db.select({
            uniqueCustomers: countDistinct(reservationsTable.user_id),
            totalReservations: count(reservationsTable.id),
            totalGuests: sum(reservationsTable.party_size),
        })
            .from(reservationsTable)
            .where(and(
                inArray(reservationsTable.venue_match_id, vmIds),
                gte(reservationsTable.created_at, thirtyDaysAgo)
            ));

        return {
            customerCount: Number(stats[0]?.uniqueCustomers) || 0,
            totalGuests: Number(stats[0]?.totalGuests) || 0,
            totalReservations: Number(stats[0]?.totalReservations) || 0,
        };
    }

    /**
     * Get venue clients data
     * Note: neon-http driver doesn't support transactions, using sequential queries
     */
    async getVenueClientsData(venueId: string, ownerId: string) {
        // Verify ownership
        const [venue] = await db.select({ id: venuesTable.id })
            .from(venuesTable)
            .where(and(eq(venuesTable.id, venueId), eq(venuesTable.owner_id, ownerId)))
            .limit(1);

        if (!venue) {
            return { authorized: false, clients: [] };
        }

        // Get venue match IDs
        const venueMatches = await db.select({ id: venueMatchesTable.id })
            .from(venueMatchesTable)
            .where(eq(venueMatchesTable.venue_id, venueId));

        if (venueMatches.length === 0) {
            return { authorized: true, clients: [] };
        }

        const vmIds = venueMatches.map(vm => vm.id);

        // Get reservations with related data
        const reservations = await db.query.reservationsTable.findMany({
            where: inArray(reservationsTable.venue_match_id, vmIds),
            with: {
                user: {
                    columns: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    }
                },
                venueMatch: {
                    with: {
                        match: {
                            with: {
                                homeTeam: true,
                                awayTeam: true,
                            }
                        }
                    }
                }
            },
            orderBy: (reservations, { desc }) => [desc(reservations.created_at)],
        });

        return { authorized: true, clients: reservations };
    }
}
