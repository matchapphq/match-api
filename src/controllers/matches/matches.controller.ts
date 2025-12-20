import { createFactory } from "hono/factory";
import { db } from "../../config/config.db";
import { matchesTable, venueMatchesTable } from "../../config/db/matches.table";
import { venuesTable } from "../../config/db/venues.table";
import { teamsTable, leaguesTable } from "../../config/db/sports.table";
import { eq, and, gte, desc, asc, sql } from "drizzle-orm";

/**
 * Controller for Matches operations.
 * Handles fetching match lists, details, upcoming matches, and venues showing matches.
 */
class MatchesController {
    private readonly factory = createFactory();

    /**
     * GET /matches - List all upcoming matches
     */
    readonly getMatches = this.factory.createHandlers(async (c) => {
        try {
            const { league_id, status, limit = "20", offset = "0" } = c.req.query();

            const matches = await db.query.matchesTable.findMany({
                where: status 
                    ? eq(matchesTable.status, status as any)
                    : gte(matchesTable.scheduled_at, new Date()),
                with: {
                    homeTeam: true,
                    awayTeam: true,
                    league: true,
                },
                orderBy: [asc(matchesTable.scheduled_at)],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return c.json({ 
                data: matches,
                count: matches.length
            });
        } catch (error: any) {
            console.error("Error fetching matches:", error);
            return c.json({ error: "Failed to fetch matches" }, 500);
        }
    });

    /**
     * GET /matches/:matchId - Get match details
     */
    readonly getMatchDetails = this.factory.createHandlers(async (c) => {
        try {
            const matchId = c.req.param("matchId");
            if (!matchId) return c.json({ error: "Match ID required" }, 400);

            const match = await db.query.matchesTable.findFirst({
                where: eq(matchesTable.id, matchId),
                with: {
                    homeTeam: true,
                    awayTeam: true,
                    league: true,
                },
            });

            if (!match) {
                return c.json({ error: "Match not found" }, 404);
            }

            return c.json({ data: match });
        } catch (error: any) {
            console.error("Error fetching match:", error);
            return c.json({ error: "Failed to fetch match" }, 500);
        }
    });

    /**
     * GET /matches/:matchId/venues - Get venues showing this match
     * This is key for users to find where to watch a match and make reservations
     */
    readonly getMatchVenues = this.factory.createHandlers(async (c) => {
        try {
            const matchId = c.req.param("matchId");
            if (!matchId) return c.json({ error: "Match ID required" }, 400);

            const { lat, lng, distance_km = "10" } = c.req.query();

            // Get venue matches with venue details
            const venueMatches = await db.query.venueMatchesTable.findMany({
                where: and(
                    eq(venueMatchesTable.match_id, matchId),
                    eq(venueMatchesTable.is_active, true),
                    eq(venueMatchesTable.allows_reservations, true)
                ),
                with: {
                    venue: {
                        columns: {
                            id: true,
                            name: true,
                            city: true,
                            street_address: true,
                            phone: true,
                            latitude: true,
                            longitude: true,
                        }
                    },
                },
            });

            // Transform to include availability info
            const venues = venueMatches.map(vm => ({
                venueMatchId: vm.id,
                venue: vm.venue,
                totalCapacity: vm.total_capacity,
                availableCapacity: vm.available_capacity,
                maxGroupSize: vm.max_group_size,
                isFeatured: vm.is_featured,
                allowsReservations: vm.allows_reservations,
            }));

            return c.json({ 
                data: venues,
                count: venues.length
            });
        } catch (error: any) {
            console.error("Error fetching match venues:", error);
            return c.json({ error: "Failed to fetch venues" }, 500);
        }
    });

    /**
     * GET /matches/upcoming-nearby - Get upcoming matches at venues near user
     */
    readonly getUpcomingNearby = this.factory.createHandlers(async (c) => {
        try {
            const { lat, lng, distance_km = "10", limit = "20" } = c.req.query();

            // Get upcoming venue matches
            const venueMatches = await db.query.venueMatchesTable.findMany({
                where: and(
                    eq(venueMatchesTable.is_active, true),
                    eq(venueMatchesTable.allows_reservations, true)
                ),
                with: {
                    venue: {
                        columns: {
                            id: true,
                            name: true,
                            city: true,
                            latitude: true,
                            longitude: true,
                        }
                    },
                    match: {
                        with: {
                            homeTeam: true,
                            awayTeam: true,
                            league: true,
                        }
                    },
                },
                limit: parseInt(limit),
            });

            // Filter to only upcoming matches and transform
            const now = new Date();
            const upcoming = venueMatches
                .filter(vm => vm.match && new Date(vm.match.scheduled_at) > now)
                .map(vm => ({
                    venueMatchId: vm.id,
                    match: vm.match,
                    venue: {
                        id: vm.venue?.id,
                        name: vm.venue?.name,
                        city: vm.venue?.city,
                    },
                    availableCapacity: vm.available_capacity,
                    isFeatured: vm.is_featured,
                }))
                .sort((a, b) => 
                    new Date(a.match!.scheduled_at).getTime() - new Date(b.match!.scheduled_at).getTime()
                );

            return c.json({ 
                data: upcoming,
                count: upcoming.length
            });
        } catch (error: any) {
            console.error("Error fetching upcoming matches:", error);
            return c.json({ error: "Failed to fetch upcoming matches" }, 500);
        }
    });

    /**
     * GET /matches/:matchId/live-updates - Placeholder for live score updates
     */
    readonly getLiveUpdates = this.factory.createHandlers(async (c) => {
        const matchId = c.req.param("matchId");
        
        // This would typically connect to a live sports data API
        return c.json({ 
            message: "Live updates not yet implemented",
            matchId,
            tip: "Integrate with a sports data API like SportRadar or API-Football"
        });
    });
}

export default MatchesController;
