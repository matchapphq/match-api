import { createFactory } from "hono/factory";
import { ReviewsLogic } from "./reviews.logic";
import { HonoEnv } from "../../types/hono.types";

/**
 * Controller for Reviews operations.
 */
class ReviewsController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly reviewsLogic: ReviewsLogic;

    constructor() {
        this.reviewsLogic = new ReviewsLogic();
    }

    readonly createReview = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        const user = ctx.get("user");
        const body = await ctx.req.json();

        try {
            const review = await this.reviewsLogic.createReview(user.id, venueId, body);
            return ctx.json(review, 201);
        } catch (error: any) {
            console.error("Error creating review:", error);
            return ctx.json({ error: error.message || "Failed to create review" }, 500);
        }
    });

    readonly getVenueReviews = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        const { page, limit } = ctx.req.query();

        try {
            const [reviews, stats] = await Promise.all([
                this.reviewsLogic.getVenueReviews(
                    venueId, 
                    page ? parseInt(page) : 1, 
                    limit ? parseInt(limit) : 20,
                ),
                this.reviewsLogic.getVenueReviewStats(venueId),
            ]);
            return ctx.json({ reviews, stats });
        } catch (error: any) {
            console.error("Error fetching reviews:", error);
            return ctx.json({ error: "Failed to fetch reviews" }, 500);
        }
    });

    readonly updateReview = this.factory.createHandlers(async (ctx) => {
        // Implementation for update if needed
        return ctx.json({ message: "Not implemented" }, 501);
    });

    readonly deleteReview = this.factory.createHandlers(async (ctx) => {
        const reviewId = ctx.req.param("reviewId");
        const user = ctx.get("user");

        try {
            await this.reviewsLogic.deleteReview(reviewId, user.id);
            return ctx.json({ message: "Review deleted" });
        } catch (error: any) {
            if (error.message === "REVIEW_NOT_FOUND_OR_UNAUTHORIZED") {
                return ctx.json({ error: "Review not found or unauthorized" }, 404);
            }
            return ctx.json({ error: "Failed to delete review" }, 500);
        }
    });

    readonly markHelpful = this.factory.createHandlers(async (ctx) => {
        const reviewId = ctx.req.param("reviewId");
        const user = ctx.get("user");
        const { is_helpful } = await ctx.req.json();

        try {
            await this.reviewsLogic.toggleHelpful(reviewId, user.id, is_helpful);
            return ctx.json({ success: true });
        } catch (error: any) {
            return ctx.json({ error: "Failed to mark review helpful" }, 500);
        }
    });
}

export default ReviewsController;
