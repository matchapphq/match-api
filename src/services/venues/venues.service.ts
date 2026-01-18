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
        this.router.get("/:venueId/opening-hours", ...this.controller.getOpeningHours);
        this.router.get("/:venueId/menu", ...this.controller.getMenu);

        // Venue Owner Only (requires venue_owner or admin role)
        this.router.post("/", authMiddleware, venueOwnerMiddleware, ...this.controller.create);
        this.router.put("/:venueId", authMiddleware, venueOwnerMiddleware, ...this.controller.update);
        this.router.delete("/:venueId", authMiddleware, venueOwnerMiddleware, ...this.controller.delete);
        this.router.put("/:venueId/booking-mode", authMiddleware, venueOwnerMiddleware, ...this.controller.updateBookingMode);
        
        // Photos management (owner only)
        this.router.post("/:venueId/photos", authMiddleware, venueOwnerMiddleware, ...this.controller.uploadPhoto);
        this.router.delete("/:venueId/photos/:photoId", authMiddleware, venueOwnerMiddleware, ...this.controller.deletePhoto);
        this.router.put("/:venueId/photos/:photoId/primary", authMiddleware, venueOwnerMiddleware, ...this.controller.setPrimaryPhoto);
        
        // Opening hours (owner only)
        this.router.put("/:venueId/opening-hours", authMiddleware, venueOwnerMiddleware, ...this.controller.updateOpeningHours);
        
        // Opening hours exceptions
        this.router.get("/:venueId/opening-hours/exceptions", ...this.controller.getOpeningHoursExceptions);
        this.router.post("/:venueId/opening-hours/exceptions", authMiddleware, venueOwnerMiddleware, ...this.controller.addOpeningHoursException);
        this.router.delete("/:venueId/opening-hours/exceptions/:exceptionId", authMiddleware, venueOwnerMiddleware, ...this.controller.deleteOpeningHoursException);
        
        // Menu management (owner only)
        this.router.post("/:venueId/menu", authMiddleware, venueOwnerMiddleware, ...this.controller.updateMenu);
        
        // Amenities
        this.router.get("/:venueId/amenities", ...this.controller.getVenueAmenities);
        this.router.put("/:venueId/amenities", authMiddleware, venueOwnerMiddleware, ...this.controller.setVenueAmenities);

        // Favorites (Any authenticated user)
        this.router.post("/:venueId/favorite", authMiddleware, ...this.controller.addFavorite);
        this.router.delete("/:venueId/favorite", authMiddleware, ...this.controller.removeFavorite);
        this.router.patch("/:venueId/favorite", authMiddleware, ...this.controller.updateFavoriteNote);
        this.router.get("/:venueId/favorite", authMiddleware, ...this.controller.checkFavorite);
    }
}

export default VenueService;
