import { createFactory } from "hono/factory";

/**
 * Controller for Venue operations (Read-Only/User Facing).
 * Handles fetching simple venue details, photos, reviews, and availability.
 */
class VenueController {
    private readonly factory = createFactory();

    readonly getDetails = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Venue details" });
    });

    readonly getPhotos = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Venue photos" });
    });

    readonly getReviews = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Venue reviews" });
    });

    readonly getMatches = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Venue matches" });
    });

    readonly getAvailability = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Venue availability" });
    });
}

export default VenueController;
