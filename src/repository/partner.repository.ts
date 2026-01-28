import { db } from "../config/config.db";
import { venuesTable } from "../config/db/venues.table";
import { venueMatchesTable, matchesTable } from "../config/db/matches.table";
import { reservationsTable } from "../config/db/reservations.table";
import { reviewsTable } from "../config/db/reviews.table";
import { analyticsTable } from "../config/db/admin.table";
import { eq, and, sql, inArray, count, countDistinct, gte, lte, sum } from "drizzle-orm";

export class PartnerRepository {

    /**
     * Get recent activity (reservations and reviews) for a partner across all their venues
     */
    async getRecentActivity(ownerId: string, limit: number = 20) {
        const venueIds = await this.getVenueIdsByOwnerId(ownerId);
        
        if (venueIds.length === 0) {
            return [];
        }

        // 1. Get recent reservations
        const reservations = await db.query.reservationsTable.findMany({
            where: inArray(reservationsTable.venue_match_id, 
                db.select({ id: venueMatchesTable.id })
                  .from(venueMatchesTable)
                  .where(inArray(venueMatchesTable.venue_id, venueIds))
            ),
            with: {
                user: {
                    columns: {
                        first_name: true,
                        last_name: true,
                    }
                },
                venueMatch: {
                    with: {
                        venue: {
                            columns: {
                                id: true,
                                name: true,
                            }
                        },
                        match: {
                           columns: {
                               id: true
                           },
                           with: {
                               homeTeam: true,
                               awayTeam: true
                           }
                        }
                    }
                }
            },
            orderBy: (reservations, { desc }) => [desc(reservations.created_at)],
            limit: limit,
        });

        // 2. Get recent reviews
        const reviews = await db.query.reviewsTable.findMany({
            where: inArray(reviewsTable.venue_id, venueIds),
            with: {
                user: {
                    columns: {
                        first_name: true,
                        last_name: true,
                    }
                },
                venue: {
                    columns: {
                        id: true,
                        name: true,
                    }
                }
            },
            orderBy: (reviews, { desc }) => [desc(reviews.created_at)],
            limit: limit,
        });
        
        // 3. Combine and sort
        const activity = [
            ...reservations.map(r => ({
                type: 'reservation',
                id: r.id,
                created_at: r.created_at,
                venue_id: r.venueMatch?.venue?.id,
                venue_name: r.venueMatch?.venue?.name,
                user_name: `${r.user?.first_name || 'Guest'} ${r.user?.last_name || ''}`.trim(),
                details: {
                    status: r.status,
                    party_size: r.party_size,
                    match: r.venueMatch?.match ? `${r.venueMatch.match.homeTeam?.name} vs ${r.venueMatch.match.awayTeam?.name}` : null
                }
            })),
            ...reviews.map(r => ({
                type: 'review',
                id: r.id,
                created_at: r.created_at,
                venue_id: r.venue?.id,
                venue_name: r.venue?.name,
                user_name: `${r.user?.first_name || 'Guest'} ${r.user?.last_name || ''}`.trim(),
                details: {
                    rating: r.rating,
                    content: r.content,
                    title: r.title
                }
            }))
        ].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
        }).slice(0, limit);

        return activity;
    }

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
        coords?: { lat: number, lng: number };
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
            location: sql`ST_SetSRID(ST_MakePoint(${data.coords?.lat || 0}, ${data.coords?.lng || 0}), 4326)`,
            latitude: data.coords?.lat || 0,
            longitude: data.coords?.lng || 0,
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
     * Get complete analytics summary for a partner including trends
     * Note: neon-http driver doesn't support transactions, using sequential queries
     */
    async getAnalyticsSummary(venueIds: string[], days: number = 30) {
        if (venueIds.length === 0) {
            return {
                venueMatches: [],
                clientStats: { uniqueUsers: 0, totalReservations: 0 },
                matchStats: [],
                totalViews: 0,
                trends: {
                    clients: 0,
                    reservations: 0,
                    matches: 0,
                    views: 0
                }
            };
        }

        const now = new Date();
        const currentPeriodStart = new Date();
        currentPeriodStart.setDate(now.getDate() - days);
        
        const previousPeriodStart = new Date();
        previousPeriodStart.setDate(now.getDate() - (days * 2));

        // Helper to calculate percentage change
        const calculateTrend = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100 * 10) / 10;
        };

        // 1. Get venue matches with capacity
        const venueMatches = await db.select({
            id: venueMatchesTable.id,
            total_capacity: venueMatchesTable.total_capacity,
            reserved_capacity: venueMatchesTable.reserved_capacity,
        }).from(venueMatchesTable).where(inArray(venueMatchesTable.venue_id, venueIds));

        const vmIds = venueMatches.map(vm => vm.id);

        // 2. Client Statistics (Current vs Previous)
        let clientStats = { uniqueUsers: 0, totalReservations: 0 };
        let prevClientStats = { uniqueUsers: 0, totalReservations: 0 };
        
        if (vmIds.length > 0) {
            // Current period
            const stats = await db.select({
                uniqueUsers: countDistinct(reservationsTable.user_id),
                totalReservations: count(reservationsTable.id),
            }).from(reservationsTable).where(and(
                inArray(reservationsTable.venue_match_id, vmIds),
                gte(reservationsTable.created_at, currentPeriodStart)
            ));

            clientStats = {
                uniqueUsers: Number(stats[0]?.uniqueUsers) || 0,
                totalReservations: Number(stats[0]?.totalReservations) || 0,
            };

            // Previous period
            const prevStats = await db.select({
                uniqueUsers: countDistinct(reservationsTable.user_id),
                totalReservations: count(reservationsTable.id),
            }).from(reservationsTable).where(and(
                inArray(reservationsTable.venue_match_id, vmIds),
                gte(reservationsTable.created_at, previousPeriodStart),
                lte(reservationsTable.created_at, currentPeriodStart)
            ));

            prevClientStats = {
                uniqueUsers: Number(prevStats[0]?.uniqueUsers) || 0,
                totalReservations: Number(prevStats[0]?.totalReservations) || 0,
            };
        }

        // 3. Match Statistics (Completed matches in periods)
        const currentMatches = await db.select({ count: count() })
            .from(venueMatchesTable)
            .innerJoin(matchesTable, eq(venueMatchesTable.match_id, matchesTable.id))
            .where(and(
                inArray(venueMatchesTable.venue_id, venueIds),
                eq(matchesTable.status, 'finished'),
                gte(matchesTable.scheduled_at, currentPeriodStart)
            ));

        const prevMatches = await db.select({ count: count() })
            .from(venueMatchesTable)
            .innerJoin(matchesTable, eq(venueMatchesTable.match_id, matchesTable.id))
            .where(and(
                inArray(venueMatchesTable.venue_id, venueIds),
                eq(matchesTable.status, 'finished'),
                gte(matchesTable.scheduled_at, previousPeriodStart),
                lte(matchesTable.scheduled_at, currentPeriodStart)
            ));

        // Get all match stats for overall counts (upcoming/completed total)
        const matchStats = await db.select({
            matchId: venueMatchesTable.match_id,
            scheduledAt: matchesTable.scheduled_at,
            status: matchesTable.status,
        })
            .from(venueMatchesTable)
            .innerJoin(matchesTable, eq(venueMatchesTable.match_id, matchesTable.id))
            .where(inArray(venueMatchesTable.venue_id, venueIds));

        // 4. View Statistics (Current vs Previous)
        const currentViews = await db.select({ count: count() })
            .from(analyticsTable)
            .where(and(
                inArray(analyticsTable.venue_id, venueIds),
                eq(analyticsTable.event_type, 'venue_view'),
                gte(analyticsTable.created_at, currentPeriodStart)
            ));

        const prevViews = await db.select({ count: count() })
            .from(analyticsTable)
            .where(and(
                inArray(analyticsTable.venue_id, venueIds),
                eq(analyticsTable.event_type, 'venue_view'),
                gte(analyticsTable.created_at, previousPeriodStart),
                lte(analyticsTable.created_at, currentPeriodStart)
            ));

        const totalViewsResult = await db.select({ count: count() })
            .from(analyticsTable)
            .where(and(
                inArray(analyticsTable.venue_id, venueIds),
                eq(analyticsTable.event_type, 'venue_view')
            ));

        return {
            venueMatches,
            clientStats,
            matchStats,
            totalViews: Number(totalViewsResult[0]?.count) || 0,
            trends: {
                clients: calculateTrend(clientStats.uniqueUsers, prevClientStats.uniqueUsers),
                reservations: calculateTrend(clientStats.totalReservations, prevClientStats.totalReservations),
                matches: calculateTrend(Number(currentMatches[0]?.count) || 0, Number(prevMatches[0]?.count) || 0),
                views: calculateTrend(Number(currentViews[0]?.count) || 0, Number(prevViews[0]?.count) || 0),
            }
        };
    }

    /**
     * Get venue clients data in a single transaction
     * Combines ownership verification and data fetching
     */
    /**
     * Get customer count for a configurable period for given venue IDs
     * @param venueIds - Array of venue IDs to get stats for
     * @param days - Number of days to look back (default: 30)
     */
    async getCustomerStats(venueIds: string[], days: number = 30) {
        if (venueIds.length === 0) {
            return { customerCount: 0, totalGuests: 0, totalReservations: 0 };
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get venue match IDs for these venues (no transaction needed)
        const venueMatches = await db.select({ id: venueMatchesTable.id })
            .from(venueMatchesTable)
            .where(inArray(venueMatchesTable.venue_id, venueIds));

        if (venueMatches.length === 0) {
            return { customerCount: 0, totalGuests: 0, totalReservations: 0 };
        }

        const vmIds = venueMatches.map(vm => vm.id);

        // Count unique customers and total guests in the specified period
        const stats = await db.select({
            uniqueCustomers: countDistinct(reservationsTable.user_id),
            totalReservations: count(reservationsTable.id),
            totalGuests: sum(reservationsTable.party_size),
        })
            .from(reservationsTable)
            .where(and(
                inArray(reservationsTable.venue_match_id, vmIds),
                gte(reservationsTable.created_at, startDate)
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

    /**
     * Update reservation status (for venue owners to confirm/decline PENDING reservations)
     * Verifies venue ownership before allowing status change
     */
    async updateReservationStatus(
        reservationId: string, 
        ownerId: string, 
        newStatus: 'CONFIRMED' | 'DECLINED'
    ): Promise<{ success: boolean; reservation?: any; error?: string; statusCode?: number }> {
        // Get the reservation with venue match and venue info
        const reservation = await db.query.reservationsTable.findFirst({
            where: eq(reservationsTable.id, reservationId),
            with: {
                venueMatch: {
                    with: {
                        venue: {
                            columns: {
                                id: true,
                                owner_id: true,
                                name: true,
                            }
                        }
                    }
                }
            }
        });

        if (!reservation) {
            return { success: false, error: "Reservation not found", statusCode: 404 };
        }

        // Verify the user owns the venue
        if (reservation.venueMatch?.venue?.owner_id !== ownerId) {
            return { success: false, error: "Not authorized to manage this reservation", statusCode: 403 };
        }

        // Check current status is PENDING
        if (reservation.status !== 'pending') {
            return { 
                success: false, 
                error: `Cannot update reservation with status '${reservation.status}'. Only PENDING reservations can be confirmed or declined.`,
                statusCode: 400 
            };
        }

        // Map the new status to database format
        const dbStatus = newStatus === 'CONFIRMED' ? 'confirmed' : 'canceled';

        // Update the reservation
        const [updated] = await db.update(reservationsTable)
            .set({
                status: dbStatus,
                updated_at: new Date(),
                ...(newStatus === 'DECLINED' ? { 
                    canceled_at: new Date(),
                    canceled_reason: 'Declined by venue owner'
                } : {})
            })
            .where(eq(reservationsTable.id, reservationId))
            .returning();

        // TODO: If CONFIRMED, generate QR code and update reservation
        // TODO: Notify user of status change

        return { 
            success: true, 
            reservation: {
                ...updated,
                status: newStatus // Return the API-friendly status
            }
        };
    }

    /**
     * Get all reservations for a specific venue
     */
    async getVenueReservations(venueId: string, ownerId: string, options: { page?: number; limit?: number; status?: string } = {}) {
        // Verify ownership
        const isOwner = await this.verifyVenueOwnership(venueId, ownerId);
        if (!isOwner) {
            return { authorized: false, reservations: [], total: 0 };
        }

        const page = options.page || 1;
        const limit = options.limit || 20;
        const offset = (page - 1) * limit;

        // Get all venue_match IDs for this venue
        const venueMatches = await db.select({ id: venueMatchesTable.id })
            .from(venueMatchesTable)
            .where(eq(venueMatchesTable.venue_id, venueId));

        if (venueMatches.length === 0) {
            return { authorized: true, reservations: [], total: 0, page, limit };
        }

        const vmIds = venueMatches.map(vm => vm.id);

        // Build conditions
        const conditions: any[] = [inArray(reservationsTable.venue_match_id, vmIds)];
        if (options.status && options.status !== 'all') {
            conditions.push(eq(reservationsTable.status, options.status as any));
        }

        // Get reservations with pagination
        const reservations = await db.query.reservationsTable.findMany({
            where: and(...conditions),
            with: {
                user: {
                    columns: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        phone: true,
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
            limit,
            offset,
        });

        // Get total count
        const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(reservationsTable)
            .where(and(...conditions));

        return {
            authorized: true,
            reservations,
            total: Number(countResult[0]?.count) || 0,
            page,
            limit,
        };
    }

    /**
     * Update a venue match
     */
    async updateVenueMatch(venueId: string, matchId: string, ownerId: string, data: {
        total_capacity?: number;
        available_capacity?: number;
        is_active?: boolean;
        is_featured?: boolean;
        allows_reservations?: boolean;
        max_group_size?: number;
        notes?: string;
    }) {
        // Verify ownership
        const isOwner = await this.verifyVenueOwnership(venueId, ownerId);
        if (!isOwner) {
            return { success: false, error: "Not authorized", statusCode: 403 };
        }

        // Find the venue match
        const venueMatch = await db.select()
            .from(venueMatchesTable)
            .where(and(
                eq(venueMatchesTable.venue_id, venueId),
                eq(venueMatchesTable.match_id, matchId)
            ))
            .limit(1);

        if (!venueMatch[0]) {
            return { success: false, error: "Venue match not found", statusCode: 404 };
        }

        // Update
        const [updated] = await db.update(venueMatchesTable)
            .set({
                ...data,
                updated_at: new Date(),
            })
            .where(and(
                eq(venueMatchesTable.venue_id, venueId),
                eq(venueMatchesTable.match_id, matchId)
            ))
            .returning();

        return { success: true, venueMatch: updated };
    }

    /**
     * Get complete analytics dashboard data
     */
    async getAnalyticsDashboard(ownerId: string, dateRange?: { start?: Date; end?: Date }) {
        const venueIds = await this.getVenueIdsByOwnerId(ownerId);
        
        if (venueIds.length === 0) {
            return {
                overview: { total_venues: 0, total_matches: 0, total_reservations: 0, total_revenue: 0 },
                reservations_by_status: {},
                reservations_over_time: [],
                top_matches: [],
                capacity_utilization: 0,
            };
        }

        // Get all venue_match IDs
        const venueMatches = await db.select({
            id: venueMatchesTable.id,
            venue_id: venueMatchesTable.venue_id,
            total_capacity: venueMatchesTable.total_capacity,
            available_capacity: venueMatchesTable.available_capacity,
        })
            .from(venueMatchesTable)
            .where(inArray(venueMatchesTable.venue_id, venueIds));

        const vmIds = venueMatches.map(vm => vm.id);

        // Overview stats
        const totalMatches = venueMatches.length;

        // Get reservation stats
        let reservationConditions: any[] = [];
        if (vmIds.length > 0) {
            reservationConditions.push(inArray(reservationsTable.venue_match_id, vmIds));
        }
        if (dateRange?.start) {
            reservationConditions.push(gte(reservationsTable.created_at, dateRange.start));
        }

        const reservationStats = vmIds.length > 0 ? await db.select({
            status: reservationsTable.status,
            count: count(),
        })
            .from(reservationsTable)
            .where(and(...reservationConditions))
            .groupBy(reservationsTable.status) : [];

        // Process stats
        const reservationsByStatus: Record<string, number> = {};
        let totalReservations = 0;

        for (const stat of reservationStats) {
            reservationsByStatus[stat.status] = Number(stat.count);
            totalReservations += Number(stat.count);
        }

        // Capacity utilization
        const totalCapacity = venueMatches.reduce((sum, vm) => sum + (vm.total_capacity || 0), 0);
        const usedCapacity = venueMatches.reduce((sum, vm) => {
            const used = (vm.total_capacity || 0) - (vm.available_capacity || 0);
            return sum + used;
        }, 0);
        const capacityUtilization = totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0;

        return {
            overview: {
                total_venues: venueIds.length,
                total_matches: totalMatches,
                total_reservations: totalReservations,
            },
            reservations_by_status: reservationsByStatus,
            capacity_utilization: capacityUtilization,
        };
    }

    /**
     * Get matches calendar view for a venue
     */
    async getMatchesCalendar(venueId: string, ownerId: string, options?: { month?: string; status?: string }) {
        // Verify ownership
        const venue = await db.query.venuesTable.findFirst({
            where: and(eq(venuesTable.id, venueId), eq(venuesTable.owner_id, ownerId))
        });
        if (!venue) {
            return { success: false, error: "Not authorized", statusCode: 403 };
        }

        // Parse month filter
        let startDate: Date | undefined;
        let endDate: Date | undefined;
        if (options?.month) {
            const parts = options.month.split('-').map(Number);
            const year = parts[0] ?? new Date().getFullYear();
            const month = parts[1] ?? 1;
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59);
        }

        // Get venue matches with match details
        const conditions = [eq(venueMatchesTable.venue_id, venueId)];

        const venueMatches = await db.select({
            id: venueMatchesTable.id,
            venue_id: venueMatchesTable.venue_id,
            match_id: venueMatchesTable.match_id,
            total_capacity: venueMatchesTable.total_capacity,
            available_capacity: venueMatchesTable.available_capacity,
            is_active: venueMatchesTable.is_active,
            created_at: venueMatchesTable.created_at,
        })
            .from(venueMatchesTable)
            .where(and(...conditions));

        // Get match details
        const matchIds = venueMatches.map(vm => vm.match_id);
        const matches = matchIds.length > 0 ? await db.select()
            .from(matchesTable)
            .where(inArray(matchesTable.id, matchIds)) : [];

        const matchMap = new Map(matches.map(m => [m.id, m]));

        // Filter by date range if month specified
        let filteredMatches = venueMatches.map(vm => {
            const match = matchMap.get(vm.match_id);
            return { ...vm, match };
        });

        if (startDate && endDate) {
            filteredMatches = filteredMatches.filter(vm => {
                const matchDate = vm.match?.scheduled_at;
                if (!matchDate) return false;
                return matchDate >= startDate && matchDate <= endDate;
            });
        }

        // Calculate summary
        const totalSeatsAvailable = filteredMatches.reduce((sum, vm) => sum + (vm.available_capacity || 0), 0);
        const totalSeatsReserved = filteredMatches.reduce((sum, vm) => {
            return sum + ((vm.total_capacity || 0) - (vm.available_capacity || 0));
        }, 0);
        const totalSeats = filteredMatches.reduce((sum, vm) => sum + (vm.total_capacity || 0), 0);
        const occupancyRate = totalSeats > 0 ? Math.round((totalSeatsReserved / totalSeats) * 100) : 0;

        // Get unique dates with matches
        const daysWithMatches = [...new Set(filteredMatches
            .filter(vm => vm.match?.scheduled_at)
            .map(vm => vm.match!.scheduled_at!.toISOString().split('T')[0])
        )];

        return {
            success: true,
            matches: filteredMatches,
            summary: {
                total_matches: filteredMatches.length,
                total_seats_available: totalSeatsAvailable,
                total_seats_reserved: totalSeatsReserved,
                occupancy_rate: occupancyRate,
            },
            days_with_matches: daysWithMatches,
        };
    }

    /**
     * Get reservation statistics for a venue
     */
    async getReservationStats(venueId: string, ownerId: string, dateRange?: { from?: Date; to?: Date }) {
        // Verify ownership
        const venue = await db.query.venuesTable.findFirst({
            where: and(eq(venuesTable.id, venueId), eq(venuesTable.owner_id, ownerId))
        });
        if (!venue) {
            return { success: false, error: "Not authorized", statusCode: 403 };
        }

        // Get venue match IDs
        const venueMatches = await db.select({ id: venueMatchesTable.id })
            .from(venueMatchesTable)
            .where(eq(venueMatchesTable.venue_id, venueId));

        const vmIds = venueMatches.map(vm => vm.id);

        if (vmIds.length === 0) {
            return {
                success: true,
                stats: {
                    period: { from: dateRange?.from?.toISOString(), to: dateRange?.to?.toISOString() },
                    reservations: { total: 0, confirmed: 0, cancelled: 0, no_show: 0, cancellation_rate: 0, no_show_rate: 0 },
                    capacity: { total_seats_available: 0, total_seats_reserved: 0, average_occupancy_rate: 0 },
                    customers: { total_unique: 0, new_customers: 0, returning_customers: 0 },
                }
            };
        }

        // Build conditions
        const conditions: any[] = [inArray(reservationsTable.venue_match_id, vmIds)];
        if (dateRange?.from) {
            conditions.push(gte(reservationsTable.created_at, dateRange.from));
        }
        if (dateRange?.to) {
            conditions.push(lte(reservationsTable.created_at, dateRange.to));
        }

        // Get reservation stats by status
        const reservationStats = await db.select({
            status: reservationsTable.status,
            count: count(),
        })
            .from(reservationsTable)
            .where(and(...conditions))
            .groupBy(reservationsTable.status);

        const statsByStatus: Record<string, number> = {};
        let total = 0;
        for (const stat of reservationStats) {
            statsByStatus[stat.status] = Number(stat.count);
            total += Number(stat.count);
        }

        const confirmed = statsByStatus['CONFIRMED'] || 0;
        const cancelled = statsByStatus['CANCELLED'] || 0;
        const noShow = statsByStatus['NO_SHOW'] || 0;
        const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
        const noShowRate = confirmed > 0 ? Math.round((noShow / confirmed) * 100) : 0;

        // Get unique customers
        const uniqueCustomers = await db.selectDistinct({ user_id: reservationsTable.user_id })
            .from(reservationsTable)
            .where(and(...conditions));

        return {
            success: true,
            stats: {
                period: { from: dateRange?.from?.toISOString(), to: dateRange?.to?.toISOString() },
                reservations: {
                    total,
                    confirmed,
                    cancelled,
                    no_show: noShow,
                    cancellation_rate: cancellationRate,
                    no_show_rate: noShowRate,
                },
                customers: {
                    total_unique: uniqueCustomers.length,
                },
            }
        };
    }

    /**
     * Update reservation details (full update)
     */
    async updateReservation(reservationId: string, ownerId: string, data: {
        status?: string;
        table_number?: string;
        notes?: string;
        party_size?: number;
        special_requests?: string;
    }) {
        // Get reservation with venue info
        const reservation = await db.query.reservationsTable.findFirst({
            where: eq(reservationsTable.id, reservationId),
            with: {
                venueMatch: {
                    with: {
                        venue: true
                    }
                }
            }
        });

        if (!reservation) {
            return { success: false, error: "Reservation not found", statusCode: 404 };
        }

        // Verify ownership
        const venueMatch = reservation.venueMatch;
        if (!venueMatch || (venueMatch.venue as any)?.owner_id !== ownerId) {
            return { success: false, error: "Not authorized to modify this reservation", statusCode: 403 };
        }

        // Check party size capacity if changing
        if (data.party_size && data.party_size !== reservation.party_size) {
            const sizeDiff = data.party_size - (reservation.party_size || 0);
            if (sizeDiff > 0 && sizeDiff > (venueMatch.available_capacity || 0)) {
                return {
                    success: false,
                    error: "Cannot increase party size: not enough available seats",
                    statusCode: 400,
                    available_seats: venueMatch.available_capacity,
                    requested_increase: sizeDiff,
                };
            }

            // Update venue match capacity
            await db.update(venueMatchesTable)
                .set({
                    available_capacity: (venueMatch.available_capacity || 0) - sizeDiff,
                    updated_at: new Date(),
                })
                .where(eq(venueMatchesTable.id, venueMatch.id));
        }

        // Update reservation
        const [updated] = await db.update(reservationsTable)
            .set({
                ...(data.status && { status: data.status as any }),
                ...(data.table_number !== undefined && { table_number: data.table_number }),
                ...(data.notes !== undefined && { notes: data.notes }),
                ...(data.party_size !== undefined && { party_size: data.party_size }),
                ...(data.special_requests !== undefined && { special_requests: data.special_requests }),
                updated_at: new Date(),
            })
            .where(eq(reservationsTable.id, reservationId))
            .returning();

        return { success: true, reservation: updated };
    }

    /**
     * Mark reservation as no-show
     */
    async markReservationNoShow(reservationId: string, ownerId: string, reason?: string) {
        // Get reservation with venue info
        const reservation = await db.query.reservationsTable.findFirst({
            where: eq(reservationsTable.id, reservationId),
            with: {
                venueMatch: {
                    with: {
                        venue: true
                    }
                }
            }
        });

        if (!reservation) {
            return { success: false, error: "Reservation not found", statusCode: 404 };
        }

        // Verify ownership
        const venueMatch = reservation.venueMatch;
        if (!venueMatch || (venueMatch.venue as any)?.owner_id !== ownerId) {
            return { success: false, error: "Not authorized to mark this reservation as no-show", statusCode: 403 };
        }

        // Check if status allows marking as no-show
        if (reservation.status !== 'confirmed' && reservation.status !== 'checked_in') {
            return {
                success: false,
                error: "Can only mark confirmed or checked_in reservations as no-show",
                statusCode: 400,
                current_status: reservation.status,
            };
        }

        const seatsToRelease = reservation.party_size || 0;

        // Update reservation
        const [updated] = await db.update(reservationsTable)
            .set({
                status: 'no_show' as any,
                special_requests: reason ? `No-show reason: ${reason}` : reservation.special_requests,
                updated_at: new Date(),
            })
            .where(eq(reservationsTable.id, reservationId))
            .returning();

        // Release seats back to available pool
        await db.update(venueMatchesTable)
            .set({
                available_capacity: (venueMatch.available_capacity || 0) + seatsToRelease,
                updated_at: new Date(),
            })
            .where(eq(venueMatchesTable.id, venueMatch.id));

        return {
            success: true,
            reservation: {
                id: updated?.id,
                status: updated?.status,
                marked_no_show_at: updated?.updated_at,
                no_show_reason: reason || null,
            },
            seats_released: seatsToRelease,
        };
    }
}
