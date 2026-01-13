import { Hono } from "hono";
import VenueController from "../../controllers/venues/venues.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { venueOwnerMiddleware } from "../../middleware/role.middleware";
import type { HonoEnv } from "../../types/hono.types";

/**
 * Service for defining Venue routes.
 * Mounts the VenueController handlers to the router.
 */
class VenueService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller = new VenueController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        // Public/Shared
        this.router.get("/", ...this.controller.getAll);
        this.router.get("/nearby", ...this.controller.getNearby);
        this.router.get("/:venueId", ...this.controller.getDetails);
        this.router.get("/:venueId/photos", ...this.controller.getPhotos);
        this.router.get("/:venueId/reviews", ...this.controller.getReviews);
        this.router.get("/:venueId/matches", ...this.controller.getMatches);
        this.router.get("/:venueId/availability", ...this.controller.getAvailability);

        // Venue Owner Only (requires venue_owner or admin role)
        this.router.post("/", authMiddleware, venueOwnerMiddleware, ...this.controller.create);
        this.router.put("/:venueId", authMiddleware, venueOwnerMiddleware, ...this.controller.update);
        this.router.delete("/:venueId", authMiddleware, venueOwnerMiddleware, ...this.controller.delete);
        this.router.put("/:venueId/booking-mode", authMiddleware, venueOwnerMiddleware, ...this.controller.updateBookingMode);

        // Favorites (Any authenticated user)
        this.router.post("/:venueId/favorite", authMiddleware, ...this.controller.addFavorite);
        this.router.delete("/:venueId/favorite", authMiddleware, ...this.controller.removeFavorite);
        this.router.patch("/:venueId/favorite", authMiddleware, ...this.controller.updateFavoriteNote);
        this.router.get("/:venueId/favorite", authMiddleware, ...this.controller.checkFavorite);
    }
}

export default VenueService;
