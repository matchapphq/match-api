import { createFactory } from "hono/factory";
import { db } from "../../config/config.db";
import { subscriptionsTable } from "../../config/db/subscriptions.table";
import { eq } from "drizzle-orm";
import type { HonoEnv } from "../../types/hono.types";
import { validator } from "hono/validator";
import { z } from "zod";

/**
 * Controller for Subscriptions operations.
 */
class SubscriptionsController {
    private readonly factory = createFactory<HonoEnv>();

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

    readonly mockSubscription = this.factory.createHandlers(validator('json', (value, c) => {
        const schema = z.object({
            status: z.enum(['active', 'inactive'])
        });
        const parsed = schema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: parsed.error }, 400);
        }
        return parsed.data;
    }), async (ctx) => {
        const user = ctx.get('user');
        if (!user || !user.id) return ctx.json({ error: "Unauthorized" }, 401);

        const { status } = ctx.req.valid('json');

        if (status === 'active') {
            // Upsert subscription
            // Check if exists
            const existing = await db.query.subscriptionsTable.findFirst({
                where: eq(subscriptionsTable.user_id, user.id)
            });

            if (existing) {
                await db.update(subscriptionsTable)
                    .set({
                        status: 'active',
                        current_period_end: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year from now
                        updated_at: new Date()
                    })
                    .where(eq(subscriptionsTable.user_id, user.id));
            } else {
                await db.insert(subscriptionsTable).values({
                    user_id: user.id,
                    plan: 'pro',
                    status: 'active',
                    current_period_start: new Date(),
                    current_period_end: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                    stripe_subscription_id: `mock_sub_${Date.now()}`,
                    stripe_payment_method_id: `mock_pm_${Date.now()}`,
                    price: "19.99"
                });
            }
            return ctx.json({ message: "Mock subscription activated" });
        } else {
            // Inactive -> Delete
            await db.delete(subscriptionsTable).where(eq(subscriptionsTable.user_id, user.id));
            return ctx.json({ message: "Mock subscription deactivated" });
        }
    });
}

export default SubscriptionsController;
