import { Hono } from "hono";
import SportsController from "../../controllers/sports/sports.controller";

/**
 * Service for defining Sports routes.
 * Mounts the SportsController handlers to the router.
 */
class SportsService {
    private readonly router = new Hono();
    private readonly controller = new SportsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.get("/", ...this.controller.getSports);
        this.router.get("/:sportId/leagues", ...this.controller.getLeagues);
        this.router.get("/leagues/:leagueId/teams", ...this.controller.getTeams);
    }
}

export default SportsService;
