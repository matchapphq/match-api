import { createFactory } from "hono/factory";

/**
 * Controller for Sports operations.
 * Handles fetching list of available sports.
 */
class SportsController {
    private readonly factory = createFactory();

    readonly getSports = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Available sports" });
    });
}

export default SportsController;
