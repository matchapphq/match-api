import { createFactory } from "hono/factory";
import { db } from "../../config/config.db";
import { matchesTable, venueMatchesTable } from "../../config/db/matches.table";
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
    public readonly getMatches = this.factory.createHandlers(async (c) => {
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
    public readonly getMatchDetails = this.factory.createHandlers(async (c) => {
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
     * Supports optional lat/lng params to calculate and sort by distance
     */
    public readonly getMatchVenues = this.factory.createHandlers(async (c) => {
        try {
            const matchId = c.req.param("matchId");
            if (!matchId) return c.json({ error: "Match ID required" }, 400);

            const { lat, lng, distance_km = "50" } = c.req.query();
            const userLat = lat ? parseFloat(lat) : null;
            const userLng = lng ? parseFloat(lng) : null;
            const maxDistanceKm = parseFloat(distance_km);

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
                            average_rating: true,
                            cover_image_url: true,
                        }
                    },
                },
            });

            // Transform to include availability info and calculate distance
            let venues = venueMatches.map((vm: any) => {
                let distance: number | null = null;
                
                // Calculate distance if user location provided and venue has coordinates
                if (userLat !== null && userLng !== null && vm.venue?.latitude && vm.venue?.longitude) {
                    distance = this.calculateDistance(
                        userLat,
                        userLng,
                        vm.venue.latitude,
                        vm.venue.longitude
                    );
                }
                
                return {
                    venueMatchId: vm.id,
                    venue: {
                        ...vm.venue,
                        rating: vm.venue?.average_rating ? parseFloat(vm.venue.average_rating) : null,
                        image_url: vm.venue?.cover_image_url,
                        distance: distance !== null ? parseFloat(distance.toFixed(2)) : null,
                    },
                    totalCapacity: vm.total_capacity,
                    availableCapacity: vm.available_capacity,
                    maxGroupSize: vm.max_group_size,
                    isFeatured: vm.is_featured,
                    allowsReservations: vm.allows_reservations,
                };
            });

            // Filter by max distance if user location provided
            if (userLat !== null && userLng !== null) {
                venues = venues.filter(v => 
                    v.venue.distance === null || v.venue.distance <= maxDistanceKm
                );
                
                // Sort by distance (closest first)
                venues.sort((a, b) => {
                    if (a.venue.distance === null) return 1;
                    if (b.venue.distance === null) return -1;
                    return a.venue.distance - b.venue.distance;
                });
            }

            return c.json({ 
                data: venues,
                count: venues.length
            });
        } catch (error: any) {
            console.error("Error fetching match venues:", error);
            return c.json({ error: "Failed to fetch venues" }, 500);
        }
    });

    // Haversine formula to calculate distance between two points in km
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of Earth in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    /**
     * GET /matches/upcoming - Get all upcoming matches
     */
    public readonly getUpcoming = this.factory.createHandlers(async (c) => {
        try {
            const { limit = "20", offset = "0" } = c.req.query();

            const matches = await db.query.matchesTable.findMany({
                where: gte(matchesTable.scheduled_at, new Date()),
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
            console.error("Error fetching upcoming matches:", error);
            return c.json({ error: "Failed to fetch upcoming matches" }, 500);
        }
    });

    /**
     * GET /matches/upcoming-nearby - Get upcoming matches at venues near user
     */
    public readonly getUpcomingNearby = this.factory.createHandlers(async (c) => {
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
    public readonly getLiveUpdates = this.factory.createHandlers(async (c) => {
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
