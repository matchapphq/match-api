import { createFactory } from "hono/factory";

/**
 * Controller for User Onboarding flow.
 * Handles fetching options (sports, ambiances) and saving user preferences.
 */
class OnboardingController {
    private readonly factory = createFactory();

    readonly getStatus = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Onboarding status" });
    });

    readonly savePreferences = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Preferences saved" });
    });

    readonly getSports = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Available sports" });
    });

    readonly getCategories = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Venue categories" });
    });

    readonly getAmbiances = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Ambiance options" });
    });
}

export default OnboardingController;
