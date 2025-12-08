import { createFactory } from "hono/factory";

/**
 * Controller for Matches operations.
 * Handles fetching match lists, details, upcoming matches, and live updates.
 */
class MatchesController {
    private readonly factory = createFactory();

    readonly getMatches = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "List matches" });
    });

    readonly getMatchDetails = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Match details" });
    });

    readonly getMatchVenues = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Venues showing match" });
    });

    readonly getUpcomingNearby = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Upcoming matches nearby" });
    });

    readonly getLiveUpdates = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Live updates" });
    });

}

export default MatchesController;
