import { Hono } from "hono";
import SeatsController from "../../controllers/seats/seats.controller";

/**
 * Service for defining Seat routes.
 * Mounts the SeatsController handlers to the router.
 */
class SeatsService {
    private readonly router = new Hono();
    private readonly controller = new SeatsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.get("/", ...this.controller.getSeatMap);
        this.router.post("/reserve", ...this.controller.reserveSeats);
        this.router.get("/pricing", ...this.controller.getPricing);
    }
}

export default SeatsService;
