import { Hono } from "hono";
import ReviewsController from "./reviews.controller";
import { ReviewsLogic } from "./reviews.logic";
import { ReviewsRepository } from "../../repository/reviews.repository";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";

/**
 * Service for defining Reviews routes.
 */
class ReviewsService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller: ReviewsController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const reviewsRepository = new ReviewsRepository();
        const reviewsLogic = new ReviewsLogic(reviewsRepository);
        this.controller = new ReviewsController(reviewsLogic);
        this.initRoutes();
    }

    private initRoutes() {
        // Public routes
        this.router.get("/venue/:venueId", ...this.controller.getVenueReviews);

        // Protected routes
        this.router.use("/*", authMiddleware);
        this.router.post("/", ...this.controller.createReview);
        this.router.put("/:reviewId", ...this.controller.updateReview);
        this.router.delete("/:reviewId", ...this.controller.deleteReview);
        this.router.post("/:reviewId/helpful", ...this.controller.markHelpful);
    }
}

export default ReviewsService;
