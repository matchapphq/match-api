import { Hono } from "hono";
import DiscoveryController from "./discovery.controller";
import { DiscoveryLogic } from "./discovery.logic";

/**
 * Service for defining Discovery routes.
 * Mounts the DiscoveryController handlers to the router.
 */
class DiscoveryService {
    private readonly router = new Hono();
    private readonly controller: DiscoveryController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const discoveryLogic = new DiscoveryLogic();
        this.controller = new DiscoveryController(discoveryLogic);
        this.initRoutes();
    }

    private initRoutes() {
        this.router.get("/nearby", ...this.controller.getNearby);
        this.router.get("/venues/:venueId", ...this.controller.getVenueDetails);
        this.router.get("/venues/:venueId/menu", ...this.controller.getVenueMenu);
        this.router.get("/venues/:venueId/hours", ...this.controller.getVenueHours);
        this.router.get("/matches-nearby", ...this.controller.getMatchesNearby);
        this.router.post("/search", ...this.controller.search);
    }
}

export default DiscoveryService;