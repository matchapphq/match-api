import { createFactory } from "hono/factory";

/**
 * Controller for Reviews operations.
 */
class ReviewsController {
    private readonly factory = createFactory();

    readonly createReview = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Create review" }, 201);
    });

    readonly getVenueReviews = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get venue reviews" });
    });

    readonly updateReview = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Update review" });
    });

    readonly deleteReview = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Delete review" });
    });

    readonly markHelpful = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Mark review helpful" });
    });
}

export default ReviewsController;
