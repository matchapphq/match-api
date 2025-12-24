import { createFactory } from "hono/factory";

/**
 * Controller for Seat operations (Nested under Venues > Matches).
 * Handles fetching seat maps, pricing, and holding/reserving seats.
 */
class SeatsController {
    private readonly factory = createFactory();

    readonly getSeatMap = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Seat map" });
    });

    readonly reserveSeats = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Seats reserved (temporary hold)" });
    });

    readonly getPricing = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Pricing details" });
    });
}

export default SeatsController;
