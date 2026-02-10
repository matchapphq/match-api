import { Hono } from "hono";
import ReviewsController from "./reviews.controller";

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
        this.router.put("/:reviewId", ...this.controller.updateReview);
        this.router.delete("/:reviewId", ...this.controller.deleteReview);
        this.router.post("/:reviewId/helpful", ...this.controller.markHelpful);
    }
}

export default ReviewsService;