import { createFactory } from "hono/factory";
import { ReviewsLogic } from "./reviews.logic";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { HonoEnv } from "../../types/hono.types";
import {CreateReviewSchema, GetVenuesReviewsSchema} from "../../utils/reviews.valid.ts";

/**
 * Controller for Reviews operations.
 */
class ReviewsController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly reviewsLogic: ReviewsLogic) {}

    public readonly createReview = this.factory.createHandlers(
        zValidator( "json", CreateReviewSchema),
        async (ctx) => {
            const body = ctx.req.valid("json");
            const user = ctx.get("user");

            const review = await this.reviewsLogic.createReview({
                ...body,
                user_id: user.id,
            });

            return ctx.json(review, 201);
        },
    );

    public readonly getVenueReviews = this.factory.createHandlers(
        zValidator( "query", GetVenuesReviewsSchema),
        async (ctx) => {
            const venueId = ctx.req.param("venueId");
            if (!venueId) {
                return ctx.json({ error: "Venue ID is required" }, 400);
            }
            const { page, limit } = ctx.req.valid("query");

            const result = await this.reviewsLogic.getVenueReviews(venueId, page, limit);
            return ctx.json(result);
        },
    );

    public readonly updateReview = this.factory.createHandlers(
        zValidator(
            "json",
            z.object({
                content: z.string().min(1),
                rating: z.number().min(1).max(5),
            }),
        ),
        async (ctx) => {
            const reviewId = ctx.req.param("reviewId");
            if (!reviewId) {
                return ctx.json({ error: "Review ID is required" }, 400);
            }
            const { content, rating } = ctx.req.valid("json");
            const user = ctx.get("user");

            const updated = await this.reviewsLogic.updateReview(reviewId, user.id, content, rating);
            return ctx.json(updated);
        },
    );

    readonly deleteReview = this.factory.createHandlers(async (ctx) => {
        const reviewId = ctx.req.param("reviewId");
        if (!reviewId) {
            return ctx.json({ error: "Review ID is required" }, 400);
        }
        const user = ctx.get("user");

        await this.reviewsLogic.deleteReview(reviewId, user.id);
        return ctx.json({ success: true });
    });

    public readonly markHelpful = this.factory.createHandlers(
        zValidator(
            "json",
            z.object({
                is_helpful: z.boolean(),
            }),
        ),
        async (ctx) => {
            const reviewId = ctx.req.param("reviewId");
            if (!reviewId) {
                return ctx.json({ error: "Review ID is required" }, 400);
            }
            const { is_helpful } = ctx.req.valid("json");
            const user = ctx.get("user");

            await this.reviewsLogic.markHelpful({
                review_id: reviewId,
                user_id: user.id,
                is_helpful,
            });

            return ctx.json({ success: true });
        },
    );
}

export default ReviewsController;
