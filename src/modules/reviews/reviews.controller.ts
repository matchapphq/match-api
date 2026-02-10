import { createFactory } from "hono/factory";

/**
 * Controller for Reviews operations.
 */
class ReviewsController {
    private readonly factory = createFactory();

    constructor() {}

    readonly createReview = this.factory.createHandlers(async (ctx) => {
        return ctx.json("hello", 201);
    });

    readonly getVenueReviews = this.factory.createHandlers(async (ctx) => {
        return ctx.json("hello");
    });

    readonly updateReview = this.factory.createHandlers(async (ctx) => {
        return ctx.json("hello");
    });

    readonly deleteReview = this.factory.createHandlers(async (ctx) => {
        return ctx.json("hello");
    });

    readonly markHelpful = this.factory.createHandlers(async (ctx) => {
        return ctx.json("hello");
    });
}

export default ReviewsController;