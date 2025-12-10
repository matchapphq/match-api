import { createFactory } from "hono/factory";

/**
 * Controller for User operations.
 */
class UserController {
    private readonly factory = createFactory();

    readonly getMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get current user profile" });
    });

    readonly updateMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Update current user profile" });
    });

    readonly deleteMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Delete user account" });
    });

    readonly getUserProfile = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get public user profile" });
    });

    readonly updateNotificationPreferences = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Update notification settings" });
    });

    readonly getAddresses = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get user addresses" });
    });

    readonly addAddress = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Add new address" });
    });

    readonly updateAddress = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Update address" });
    });

    readonly deleteAddress = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Delete address" });
    });

    readonly completeOnboarding = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Mark onboarding as complete" });
    });

    readonly getFavorites = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get user's favorite venues" });
    });
}

export default UserController;
