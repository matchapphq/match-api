import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { validator } from "hono/validator";
import { z } from "zod";
import { SubscriptionsLogic } from "./subscriptions.logic";

/**
 * Subscriptions Controller
 *
 * Legacy subscription endpoints are kept for compatibility only.
 * Billing model is now commission-only.
 */
class SubscriptionsController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly subscriptionsLogic: SubscriptionsLogic) {}

    private deprecatedSubscriptionEndpoint(ctx: any, replacement: string) {
        return ctx.json({
            error: "ENDPOINT_DEPRECATED",
            message: "Subscription billing is deprecated. Match is now commission-only (per checked-in guest).",
            replacement,
        }, 410);
    }

    /**
     * GET /subscriptions/plans
     * Deprecated: billing is commission-only
     */
    readonly getPlans = this.factory.createHandlers(async (ctx) => {
        return this.deprecatedSubscriptionEndpoint(ctx, "GET /api/billing/pricing");
    });

    /**
     * POST /subscriptions/create-checkout
     * Deprecated: billing is commission-only
     */
    readonly createCheckout = this.factory.createHandlers(async (ctx) => {
        return this.deprecatedSubscriptionEndpoint(ctx, "POST /api/billing/setup-checkout");
    });

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
     * Deprecated: billing is commission-only
     */
    readonly getMySubscription = this.factory.createHandlers(async (ctx) => {
        return this.deprecatedSubscriptionEndpoint(ctx, "GET /api/billing/payment-method");
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
     * Deprecated: billing is commission-only
     */
    readonly cancelSubscription = this.factory.createHandlers(async (ctx) => {
        return this.deprecatedSubscriptionEndpoint(ctx, "GET /api/billing/pricing");
    });

    /**
     * POST /subscriptions/me/upgrade
     * Deprecated: billing is commission-only
     */
    readonly upgradeSubscription = this.factory.createHandlers(async (ctx) => {
        return this.deprecatedSubscriptionEndpoint(ctx, "GET /api/billing/pricing");
    });

    /**
     * GET /subscriptions/invoices
     * Deprecated: use /api/invoices
     */
    readonly getMyInvoices = this.factory.createHandlers(async (ctx) => {
        return this.deprecatedSubscriptionEndpoint(ctx, "GET /api/invoices");
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
