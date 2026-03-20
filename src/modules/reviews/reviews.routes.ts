import { Hono } from "hono";
import ReviewsController from "./reviews.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { optionalAuthMiddleware } from "../../middleware/optional-auth.middleware";

/**
 * Service for defining Reviews routes.
 */
class ReviewsService {
    private readonly router = new Hono();
    private readonly controller: ReviewsController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.controller = new ReviewsController();
        this.initRoutes();
    }

    private initRoutes() {
        // Global review operations
        this.router.put("/:reviewId", authMiddleware, ...this.controller.updateReview);
        this.router.delete("/:reviewId", authMiddleware, ...this.controller.deleteReview);
        this.router.post("/:reviewId/helpful", authMiddleware, ...this.controller.markHelpful);
        
        // Venue specific review operations (often mounted under /venues/:venueId/reviews)
        // But also defined here for direct access if needed
        this.router.get("/venue/:venueId", optionalAuthMiddleware, ...this.controller.getVenueReviews);
        this.router.post("/venue/:venueId", authMiddleware, ...this.controller.createReview);
    }
}

export default ReviewsService;
