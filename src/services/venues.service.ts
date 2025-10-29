import { Hono } from "hono";
import VenuesController from "../controllers/venues.controller";

class VenuesService {
    private readonly router = new Hono();
    private readonly venuesController = new VenuesController();

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.get("/", ...this.venuesController.getVenues);
        this.router.get("/:id", ...this.venuesController.getVenue);
        this.router.post("/:id/reservations", ...this.venuesController.reserveVenue);
    }

    get getRouter() {
        return this.router;
    }
}

export default VenuesService;
