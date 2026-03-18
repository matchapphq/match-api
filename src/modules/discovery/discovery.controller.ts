import { createFactory } from "hono/factory";
import { DiscoveryLogic } from "./discovery.logic";
import type { HonoEnv } from "../../types/hono.types";

/**
 * Controller for Discovery and Map operations.
 * Handles searching for venues, getting nearby places, and venue details for the map view.
 */
class DiscoveryController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly discoveryLogic: DiscoveryLogic) {}

    readonly getNearby = this.factory.createHandlers(async (ctx) => {
        const { lat, lng, radius_km, radius } = ctx.req.query();
        
        if (!lat || !lng) {
            return ctx.json({ error: "Latitude and longitude are required" }, 400);
        }

        let radiusKm = 10;
        if (radius_km) {
            radiusKm = parseFloat(radius_km);
        } else if (radius) {
            radiusKm = parseFloat(radius) / 1000;
        }

        try {
            const result = await this.discoveryLogic.getNearby(
                parseFloat(lat), 
                parseFloat(lng), 
                radiusKm,
            );
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching nearby venues:", error);
            return ctx.json({ error: "Failed to fetch nearby venues" }, 500);
        }
    });

    readonly getVenueDetails = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        const userId = ctx.get("user")?.id;
        try {
            const result = await this.discoveryLogic.getVenueDetails(venueId, userId);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            console.error("Error fetching venue details:", error);
            return ctx.json({ error: "Failed to fetch venue details" }, 500);
        }
    });

    readonly getVenueHistory = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user")?.id;
        if (!userId) return ctx.json({ error: "Unauthorized" }, 401);

        try {
            const { limit } = ctx.req.query();
            const result = await this.discoveryLogic.getVenueHistory(
                userId, 
                limit ? parseInt(limit) : 10
            );
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching venue history:", error);
            return ctx.json({ error: "Failed to fetch venue history" }, 500);
        }
    });

    readonly getHomeData = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user")?.id;
        if (!userId) return ctx.json({ error: "Unauthorized" }, 401);

        const { lat, lng } = ctx.req.query();

        try {
            const result = await this.discoveryLogic.getHomeData(
                userId,
                lat ? parseFloat(lat) : undefined,
                lng ? parseFloat(lng) : undefined
            );
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching discovery home data:", error);
            return ctx.json({ error: "Failed to fetch discovery home data" }, 500);
        }
    });

    readonly clearVenueHistory = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user")?.id;
        if (!userId) return ctx.json({ error: "Unauthorized" }, 401);

        try {
            await this.discoveryLogic.clearVenueHistory(userId);
            return ctx.json({ success: true });
        } catch (error: any) {
            console.error("Error clearing venue history:", error);
            return ctx.json({ error: "Failed to clear venue history" }, 500);
        }
    });

    readonly toggleLeagueFollow = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user")?.id;
        if (!userId) return ctx.json({ error: "Unauthorized" }, 401);

        const leagueId = ctx.req.param("leagueId");
        try {
            const result = await this.discoveryLogic.toggleLeagueFollow(userId, leagueId);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error toggling league follow:", error);
            return ctx.json({ error: "Failed to toggle league follow" }, 500);
        }
    });

    readonly toggleTeamFollow = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user")?.id;
        if (!userId) return ctx.json({ error: "Unauthorized" }, 401);

        const teamId = ctx.req.param("teamId");
        try {
            const result = await this.discoveryLogic.toggleTeamFollow(userId, teamId);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error toggling team follow:", error);
            return ctx.json({ error: "Failed to toggle team follow" }, 500);
        }
    });

    readonly getFollowedTeams = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user")?.id;
        if (!userId) return ctx.json({ error: "Unauthorized" }, 401);

        try {
            const result = await this.discoveryLogic.getFollowedTeams(userId);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching followed teams:", error);
            return ctx.json({ error: "Failed to fetch followed teams" }, 500);
        }
    });

    readonly getFollowedLeagues = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user")?.id;
        if (!userId) return ctx.json({ error: "Unauthorized" }, 401);

        try {
            const result = await this.discoveryLogic.getFollowedLeagues(userId);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching followed leagues:", error);
            return ctx.json({ error: "Failed to fetch followed leagues" }, 500);
        }
    });

    readonly getCompetitionDetails = this.factory.createHandlers(async (ctx) => {
        const competitionId = ctx.req.param("competitionId") as string;
        const userId = ctx.get("user")?.id;
        try {
            const result = await this.discoveryLogic.getCompetitionDetails(competitionId, userId);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "COMPETITION_NOT_FOUND") return ctx.json({ error: "Competition not found" }, 404);
            console.error("Error fetching competition details:", error);
            return ctx.json({ error: "Failed to fetch competition details" }, 500);
        }
    });

    readonly getVenueMenu = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        try {
            const result = await this.discoveryLogic.getVenueMenu(venueId);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching venue menu:", error);
            return ctx.json({ error: "Failed to fetch venue menu" }, 500);
        }
    });

    readonly getVenueHours = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        try {
            const result = await this.discoveryLogic.getVenueHours(venueId);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching venue hours:", error);
            return ctx.json({ error: "Failed to fetch venue hours" }, 500);
        }
    });

    readonly getMatchesNearby = this.factory.createHandlers(async (ctx) => {
        const { lat, lng, radius_km, radius } = ctx.req.query();

        if (!lat || !lng) {
            return ctx.json({ error: "Latitude and longitude are required" }, 400);
        }

        let radiusKm = 10;
        if (radius_km) {
            radiusKm = parseFloat(radius_km);
        } else if (radius) {
            radiusKm = parseFloat(radius) / 1000;
        }

        try {
            const result = await this.discoveryLogic.getMatchesNearby(
                parseFloat(lat), 
                parseFloat(lng), 
                radiusKm,
            );
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching nearby matches:", error);
            return ctx.json({ error: "Failed to fetch nearby matches" }, 500);
        }
    });

    /**
     * GET /discovery/search - Paginated search for venues and matches
     */
    readonly search = this.factory.createHandlers(async (ctx) => {
        try {
            const params = ctx.req.query();
            const result = await this.discoveryLogic.search(params);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Discovery search error:", error);
            return ctx.json({ error: "Search failed" }, 500);
        }
    });

    public readonly getTeams = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user")?.id;
        const { sport, country, leagueId, query } = ctx.req.query();
        try {
            const result = await this.discoveryLogic.getTeams(userId, { sport, country, leagueId, query });
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching teams:", error);
            return ctx.json({ error: "Failed to fetch teams" }, 500);
        }
    });

    public readonly getFilters = this.factory.createHandlers(async (ctx) => {
        try {
            const result = await this.discoveryLogic.getFilters();
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching discovery filters:", error);
            return ctx.json({ error: "Failed to fetch filters" }, 500);
        }
    });

    public readonly getTeamDetails = this.factory.createHandlers(async (ctx) => {
        const teamId = ctx.req.param("teamId") as string;
        const userId = ctx.get("user")?.id;
        try {
            const result = await this.discoveryLogic.getTeamDetails(teamId, userId);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "TEAM_NOT_FOUND") return ctx.json({ error: "Team not found" }, 404);
            console.error("Error fetching team details:", error);
            return ctx.json({ error: "Failed to fetch team details" }, 500);
        }
    });
}

export default DiscoveryController;