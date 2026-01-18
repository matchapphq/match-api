import { Hono } from "hono";
import SportsController from "../../controllers/sports/sports.controller";

/**
 * Service for defining League routes.
 * Mounts the SportsController handlers to the router.
 */
class LeaguesService {
    private readonly router = new Hono();
    private readonly controller = new SportsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        // Leagues
        this.router.get("/:leagueId", ...this.controller.getLeagueById);
        this.router.get("/:leagueId/teams", ...this.controller.getTeamsByLeague);
    }
}

export default LeaguesService;
