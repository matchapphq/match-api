import { createFactory } from "hono/factory";
import { MatchesLogic } from "./matches.logic";

/**
 * Controller for Matches operations.
 * Handles fetching match lists, details, upcoming matches, and venues showing matches.
 */
class MatchesController {
    private readonly factory = createFactory();

    constructor(private readonly matchesLogic: MatchesLogic) {}

    /**
     * GET /matches - List all upcoming matches
     */
    public readonly getMatches = this.factory.createHandlers(async (c) => {
        try {
            const { status, limit = "20", offset = "0" } = c.req.query();

            const matches = await this.matchesLogic.getMatches(
                status, 
                parseInt(limit), 
                parseInt(offset)
            );

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

            const match = await this.matchesLogic.getMatchDetails(matchId);
            return c.json({ data: match });
        } catch (error: any) {
            if (error.message === "MATCH_NOT_FOUND") return c.json({ error: "Match not found" }, 404);
            console.error("Error fetching match:", error);
            return c.json({ error: "Failed to fetch match" }, 500);
        }
    });

    /**
     * GET /matches/:matchId/venues - Get venues showing this match
     */
    public readonly getMatchVenues = this.factory.createHandlers(async (c) => {
        try {
            const matchId = c.req.param("matchId");
            if (!matchId) return c.json({ error: "Match ID required" }, 400);

            const { lat, lng, distance_km = "50" } = c.req.query();
            const userLat = lat ? parseFloat(lat) : undefined;
            const userLng = lng ? parseFloat(lng) : undefined;
            const maxDistanceKm = parseFloat(distance_km);

            const venues = await this.matchesLogic.getMatchVenues(matchId, userLat, userLng, maxDistanceKm);

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
     * GET /matches/upcoming - Get all upcoming matches
     */
    public readonly getUpcoming = this.factory.createHandlers(async (c) => {
        try {
            const { limit = "20", offset = "0" } = c.req.query();

            const matches = await this.matchesLogic.getUpcoming(
                parseInt(limit), 
                parseInt(offset)
            );
            
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
            
            if (!lat || !lng) {
                return c.json({ error: "Lat and Lng are required" }, 400);
            }

            const upcoming = await this.matchesLogic.getUpcomingNearby(
                parseFloat(lat), 
                parseFloat(lng), 
                parseFloat(distance_km), 
                parseInt(limit)
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
        if (!matchId) return c.json({ error: "Match ID required" }, 400);

        const result = await this.matchesLogic.getLiveUpdates(matchId);
        return c.json(result);
    });
}

export default MatchesController;