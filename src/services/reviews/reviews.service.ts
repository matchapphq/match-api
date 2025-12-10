import { Hono } from "hono";
import ReviewsController from "../../controllers/reviews/reviews.controller";

/**
 * Service for defining Reviews routes.
 */
class ReviewsService {
    private readonly router = new Hono();
    private readonly controller = new ReviewsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        // Venue Reviews (Usually mounted under /venues/:venueId/reviews, but here we might need flexibility)
        // If this service is mounted at /reviews, we handle top-level review actions

        // POST /api/venues/:venueId/reviews -> This might be handled in VenueService or here if we mount properly.
        // Given Hono routing, we can't easily capture :venueId if mounted at /reviews.
        // However, the docs list:
        // PUT /api/reviews/:reviewId
        // DELETE /api/reviews/:reviewId
        // POST /api/reviews/:reviewId/helpful

        this.router.put("/:reviewId", ...this.controller.updateReview);
        this.router.delete("/:reviewId", ...this.controller.deleteReview);
        this.router.post("/:reviewId/helpful", ...this.controller.markHelpful);

        // For GET/POST /api/venues/:venueId/reviews, we should probably handle that in VenueService or 
        // mount a sub-router. But for now, let's implement the direct Review ID routes here.
    }
}

export default ReviewsService;
