import { createFactory } from "hono/factory";
import { DiscoveryLogic } from "./discovery.logic";

/**
 * Controller for Discovery and Map operations.
 * Handles searching for venues, getting nearby places, and venue details for the map view.
 */
class DiscoveryController {
    private readonly factory = createFactory();

    constructor(private readonly discoveryLogic: DiscoveryLogic) {}

    readonly getNearby = this.factory.createHandlers(async (ctx) => {
        const result = await this.discoveryLogic.getNearby();
        return ctx.json(result);
    });

    readonly getVenueDetails = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        const result = await this.discoveryLogic.getVenueDetails(venueId);
        return ctx.json(result);
    });

    readonly getVenueMenu = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        const result = await this.discoveryLogic.getVenueMenu(venueId);
        return ctx.json(result);
    });

    readonly getVenueHours = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        const result = await this.discoveryLogic.getVenueHours(venueId);
        return ctx.json(result);
    });

    readonly getMatchesNearby = this.factory.createHandlers(async (ctx) => {
        const result = await this.discoveryLogic.getMatchesNearby();
        return ctx.json(result);
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
}

export default DiscoveryController;