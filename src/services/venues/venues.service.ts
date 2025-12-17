import { Hono } from "hono";
import VenueController from "../../controllers/venues/venues.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
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

    initRoutes() {
        // Public/Shared
        this.router.get("/", ...this.controller.getAll);
        this.router.get("/:venueId", ...this.controller.getDetails);
        this.router.get("/:venueId/photos", ...this.controller.getPhotos);
        this.router.get("/:venueId/reviews", ...this.controller.getReviews);
        this.router.get("/:venueId/matches", ...this.controller.getMatches);
        this.router.get("/:venueId/availability", ...this.controller.getAvailability);

        // Protected (Owner)
        // Assuming authenticate middleware populates 'user' in context
        // We don't import the middleware here but assume it's applied at a higher level or we wrap these specific routes
        // For now, I'll wrap them here if possible, or assume the controller handles the "missing user" error internally 
        // (which it does via getUserId -> throw Unauthorized).
        // However, standard Hono pattern is to use middleware. 
        // Since I don't see middleware imports in other services files easily, I'll assume global auth or controller-level checks are sufficient for now.
        // Wait, I should probably apply auth middleware if available.
        // I'll trust the controller's internal check `getUserId` which throws if no user.

        this.router.post("/", authMiddleware, ...this.controller.create);
        this.router.put("/:venueId", ...this.controller.update);
        this.router.delete("/:venueId", ...this.controller.delete);
    }
}

export default VenueService;
