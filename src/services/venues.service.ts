import { Hono } from "hono";
import VenueController from "../controllers/venues.controller";

/**
 * Service for defining Venue routes.
 * Mounts the VenueController handlers to the router.
 */
class VenueService {
    private readonly router = new Hono();
    private readonly controller = new VenueController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.get("/:venueId", ...this.controller.getDetails);
        this.router.get("/:venueId/photos", ...this.controller.getPhotos);
        this.router.get("/:venueId/reviews", ...this.controller.getReviews);
        this.router.get("/:venueId/matches", ...this.controller.getMatches);
        this.router.get("/:venueId/availability", ...this.controller.getAvailability);
    }
}

export default VenueService;
