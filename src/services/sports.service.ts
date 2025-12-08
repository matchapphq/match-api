import { Hono } from "hono";
import SportsController from "../controllers/sports.controller";

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
    }
}

export default SportsService;
