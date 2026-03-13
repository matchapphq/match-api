import { Hono } from "hono";
import DiscoveryController from "./discovery.controller";
import { DiscoveryLogic } from "./discovery.logic";

import { authMiddleware } from "../../middleware/auth.middleware";

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
        this.router.get("/venues/:venueId", authMiddleware, ...this.controller.getVenueDetails);
        this.router.get("/venues/:venueId/menu", ...this.controller.getVenueMenu);
        this.router.get("/venues/:venueId/hours", ...this.controller.getVenueHours);
        this.router.get("/matches-nearby", ...this.controller.getMatchesNearby);
        this.router.get("/search", ...this.controller.search);
        
        // Home aggregate endpoint
        this.router.get("/home", authMiddleware, ...this.controller.getHomeData);

        // Competition and Team follows
        this.router.get("/competition/:competitionId", authMiddleware, ...this.controller.getCompetitionDetails);
        this.router.post("/competition/:leagueId/follow", authMiddleware, ...this.controller.toggleLeagueFollow);
        this.router.get("/competitions/followed", authMiddleware, ...this.controller.getFollowedLeagues);
        this.router.post("/team/:teamId/follow", authMiddleware, ...this.controller.toggleTeamFollow);
        this.router.get("/teams/followed", authMiddleware, ...this.controller.getFollowedTeams);
        
        // History routes
        this.router.get("/history", authMiddleware, ...this.controller.getVenueHistory);
        this.router.delete("/history/clear", authMiddleware, ...this.controller.clearVenueHistory);
    }
}

export default DiscoveryService;