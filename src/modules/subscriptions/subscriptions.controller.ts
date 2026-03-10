import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { validator } from "hono/validator";
import { z } from "zod";
import { SubscriptionsLogic } from "./subscriptions.logic";

/**
 * Subscriptions Controller
 *
 * Handles all subscription-related operations including:
 * - Listing available plans
 * - Creating Stripe Checkout sessions
 * - Managing user subscriptions
 * - Cancellation and upgrades
 */
class SubscriptionsController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly subscriptionsLogic: SubscriptionsLogic) {}

    /**
     * GET /subscriptions/plans
     * Returns available subscription plans
     */
    readonly getPlans = this.factory.createHandlers(async (ctx) => {
        const plans = this.subscriptionsLogic.getPlans();
        return ctx.json({ plans });
    });

    /**
     * POST /subscriptions/create-checkout
     * Creates a Stripe Checkout session for subscription
     */
    readonly createCheckout = this.factory.createHandlers(
        validator("json", (value, c) => {
            const schema = z.object({
                plan_id: z.enum(["monthly", "annual"]),
                venue_id: z.string().uuid().optional(),
                success_url: z.string().url().optional(),
                cancel_url: z.string().url().optional(),
            });
            const parsed = schema.safeParse(value);
            if (!parsed.success) {
                return c.json(
                    {
                        error: "Invalid request",
                        details: parsed.error.flatten(),
                    },
                    400,
                );
            }
            return parsed.data;
        }),
        async (ctx) => {
            const user = ctx.get("user");
            if (!user || !user.id) {
                return ctx.json({ error: "Unauthorized" }, 401);
            }

            try {
                const body = ctx.req.valid("json");
                const result = await this.subscriptionsLogic.createCheckout(user.id, body);
                return ctx.json(result);
            } catch (error: any) {
                if (error.message === "PAYMENT_SYSTEM_NOT_CONFIGURED") return ctx.json({ error: "Payment system not configured" }, 503);
                if (error.message === "INVALID_PLAN") return ctx.json({ error: "Invalid plan selected" }, 400);
                if (error.message === "USER_NOT_FOUND") return ctx.json({ error: "User not found" }, 404);

                console.error("Stripe checkout error:", error);
                return ctx.json(
                    {
                        error: "Failed to create checkout session",
                        details: error.message,
                    },
                    500,
                );
            }
        },
    );

    /**
     * POST /subscriptions/create-setup-session
     * Creates a Stripe Checkout session in setup mode (no initial charge)
     */
    public readonly createSetupSession = this.factory.createHandlers(
        validator("json", (value, c) => {
            const schema = z.object({
                success_url: z.url().optional(),
                cancel_url: z.url().optional(),
            });
            const parsed = schema.safeParse(value);
            if (!parsed.success) {
                return c.json({ error: "Invalid request", details: parsed.error }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            const user = ctx.get("user");
            if (!user || !user.id) return ctx.json({ error: "Unauthorized" }, 401);

            try {
                const { success_url, cancel_url } = ctx.req.valid("json");
                const result = await this.subscriptionsLogic.createSetupSession(user.id, success_url, cancel_url);
                return ctx.json(result);
            } catch (error: any) {
                console.error("Create setup session error:", error);
                return ctx.json({ error: "Failed to create setup session", details: error.message }, 500);
            }
        },
    );

    /**
     * GET /subscriptions/me
     * Returns current user's subscription
     */
    readonly getMySubscription = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user || !user.id) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        try {
            const result = await this.subscriptionsLogic.getMySubscription(user.id);
            return ctx.json({ subscription: result });
        } catch (error: any) {
            console.error("Get subscription error:", error);
            return ctx.json({ error: "Failed to fetch subscription" }, 500);
        }
    });

    /**
     * POST /subscriptions/me/update-payment-method
     * Creates a Stripe portal session to update payment method
     */
    readonly updatePaymentMethod = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user || !user.id) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        try {
            const result = await this.subscriptionsLogic.updatePaymentMethod(user.id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "PAYMENT_SYSTEM_NOT_CONFIGURED") return ctx.json({ error: "Payment system not configured" }, 503);
            if (error.message === "NO_PAYMENT_PROFILE") return ctx.json({ error: "No payment profile found" }, 404);

            console.error("Update payment method error:", error);
            return ctx.json({ error: "Failed to create portal session" }, 500);
        }
    });

    /**
     * POST /subscriptions/me/cancel
     * Cancels the user's subscription (at period end)
     */
    readonly cancelSubscription = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user || !user.id) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        try {
            const result = await this.subscriptionsLogic.cancelSubscription(user.id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "NO_ACTIVE_SUBSCRIPTION") return ctx.json({ error: "No active subscription found" }, 404);
            if (error.message === "SUBSCRIPTION_ALREADY_CANCELED") return ctx.json({ error: "Subscription already canceled" }, 400);
            
            if (error.message.startsWith("COMMITMENT_PERIOD")) {
                const parts = error.message.split(":");
                return ctx.json(
                    {
                        error: "Cannot cancel during commitment period",
                        message: `Votre engagement de 12 mois se termine le ${parts[1]}. Il reste ${parts[2]} mois avant de pouvoir résilier.`,
                    },
                    403,
                );
            }

            console.error("Cancel subscription error:", error);
            return ctx.json({ error: "Failed to cancel subscription" }, 500);
        }
    });

    /**
     * POST /subscriptions/me/upgrade
     * Upgrades/changes the subscription plan
     */
    readonly upgradeSubscription = this.factory.createHandlers(
        validator("json", (value, c) => {
            const schema = z.object({
                plan_id: z.enum(["monthly", "annual"]),
            });
            const parsed = schema.safeParse(value);
            if (!parsed.success) {
                return c.json({ error: "Invalid request" }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            const user = ctx.get("user");
            if (!user || !user.id) {
                return ctx.json({ error: "Unauthorized" }, 401);
            }

            try {
                const { plan_id } = ctx.req.valid("json");
                const result = await this.subscriptionsLogic.upgradeSubscription(user.id, plan_id);
                return ctx.json(result);
            } catch (error: any) {
                if (error.message === "INVALID_PLAN") return ctx.json({ error: "Invalid plan" }, 400);
                if (error.message === "NO_ACTIVE_SUBSCRIPTION") return ctx.json({ error: "No active subscription found" }, 404);

                console.error("Upgrade subscription error:", error);
                return ctx.json(
                    { error: "Failed to upgrade subscription" },
                    500,
                );
            }
        },
    );

    /**
     * GET /subscriptions/invoices
     * Returns all invoices for the current user
     */
    readonly getMyInvoices = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user || !user.id) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        try {
            const invoices = await this.subscriptionsLogic.getMyInvoices(user.id);
            return ctx.json({ invoices });
        } catch (error: any) {
            console.error("Get invoices error:", error);
            return ctx.json({ error: "Failed to fetch invoices" }, 500);
        }
    });

    /**
     * POST /subscriptions/mock (Development only)
     * Toggles mock subscription for testing
     */
    readonly mockSubscription = this.factory.createHandlers(
        validator("json", (value, c) => {
            const schema = z.object({
                status: z.enum(["active", "inactive"]),
            });
            const parsed = schema.safeParse(value);
            if (!parsed.success) {
                return c.json({ error: parsed.error }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            const user = ctx.get("user");
            if (!user || !user.id)
                return ctx.json({ error: "Unauthorized" }, 401);

            const { status } = ctx.req.valid("json");
            const result = await this.subscriptionsLogic.mockSubscription(user.id, status);
            return ctx.json(result);
        },
    );
}

export default SubscriptionsController;