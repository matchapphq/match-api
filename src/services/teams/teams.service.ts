import { Hono } from "hono";
import SportsController from "../../controllers/sports/sports.controller";

/**
 * Service for defining Team routes.
 * Mounts the SportsController handlers to the router.
 */
class TeamsService {
    private readonly router = new Hono();
    private readonly controller = new SportsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        // Teams
        this.router.get("/:teamId", ...this.controller.getTeamById);
    }
}

export default TeamsService;
