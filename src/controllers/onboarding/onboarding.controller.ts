import { createFactory } from "hono/factory";
import OnboardingRepository from "../../repository/onboarding.repository";

/**
 * Controller for User Onboarding flow.
 * Handles fetching options (sports, ambiances) and saving user preferences.
 */
class OnboardingController {
    private readonly factory = createFactory();
    private readonly repository = new OnboardingRepository();

    readonly getStatus = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Onboarding status" });
    });

    readonly savePreferences = this.factory.createHandlers(async (ctx) => {
        // In a real app we should validate body with Zod
        // For now trusting the shape matches or partial matches
        const body = await ctx.req.json();
        const payload = ctx.get('jwtPayload'); // Hono JWT middleware payload

        // Fallback or explicit check
        const userId = payload?.id || body.user_id;

        if (!userId) {
            return ctx.json({ error: "Unauthorized or missing user_id" }, 401);
        }

        const result = await this.repository.savePreferences(userId, body);
        return ctx.json({ preferences: result });
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
