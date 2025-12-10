import { createFactory } from "hono/factory";

/**
 * Controller for Subscriptions operations.
 */
class SubscriptionsController {
    private readonly factory = createFactory();

    readonly getPlans = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get subscription plans" });
    });

    readonly createCheckout = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Create checkout session" });
    });

    readonly getMySubscription = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get current subscription" });
    });

    readonly updatePaymentMethod = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Update payment method" });
    });

    readonly cancelSubscription = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Cancel subscription" });
    });

    readonly upgradeSubscription = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Upgrade subscription" });
    });
}

export default SubscriptionsController;
