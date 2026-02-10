import { Hono } from "hono";
import MatchesController from "./matches.controller";
import { MatchesLogic } from "./matches.logic";

/**
 * Service for defining Matches routes (Router/Module layer).
 */
class MatchesService {
    private readonly router = new Hono();
    private readonly controller: MatchesController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const matchesLogic = new MatchesLogic();
        this.controller = new MatchesController(matchesLogic);
        this.initRoutes();
    }

    private initRoutes() {
        this.router.get("/", ...this.controller.getMatches);
        this.router.get("/upcoming", ...this.controller.getUpcoming);
        this.router.get("/upcoming-nearby", ...this.controller.getUpcomingNearby);
        this.router.get("/:matchId", ...this.controller.getMatchDetails);
        this.router.get("/:matchId/venues", ...this.controller.getMatchVenues);
        this.router.get("/:matchId/live-updates", ...this.controller.getLiveUpdates);
    }
}

export default MatchesService;