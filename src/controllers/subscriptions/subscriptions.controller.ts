import { createFactory } from "hono/factory";
import { db } from "../../config/config.db";
import { subscriptionsTable } from "../../config/db/subscriptions.table";
import { usersTable } from "../../config/db/user.table";
import { eq } from "drizzle-orm";
import type { HonoEnv } from "../../types/hono.types";
import { validator } from "hono/validator";
import { z } from "zod";
import Stripe from "stripe";
import stripe, { SUBSCRIPTION_PLANS, CHECKOUT_URLS, getPlanById, isStripeConfigured } from "../../config/stripe";
import subscriptionsRepository from "../../repository/subscriptions.repository";

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

    /**
     * GET /subscriptions/plans
     * Returns available subscription plans
     */
    readonly getPlans = this.factory.createHandlers(async (ctx) => {
        const plans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
            id: plan.id,
            name: plan.name,
            price: plan.price,
            currency: plan.currency,
            interval: plan.interval,
            features: plan.features,
            description: plan.description,
            pricePerMonth: 'pricePerMonth' in plan ? plan.pricePerMonth : plan.price,
        }));

        return ctx.json({ plans });
    });

    /**
     * POST /subscriptions/create-checkout
     * Creates a Stripe Checkout session for subscription
     */
    readonly createCheckout = this.factory.createHandlers(validator('json', (value, c) => {
        const schema = z.object({
            plan_id: z.enum(['monthly', 'annual']),
            venue_id: z.string().uuid().optional(),
        });
        const parsed = schema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
        }
        return parsed.data;
    }), async (ctx) => {
        const user = ctx.get('user');
        if (!user || !user.id) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        // Check if Stripe is configured
        if (!isStripeConfigured()) {
            return ctx.json({ error: "Payment system not configured" }, 503);
        }

        const { plan_id, venue_id } = ctx.req.valid('json');
        const plan = getPlanById(plan_id);

        if (!plan || !plan.stripePriceId) {
            return ctx.json({ error: "Invalid plan selected" }, 400);
        }

        try {
            // Get or create Stripe customer
            let stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(user.id);

            if (!stripeCustomerId) {
                // Get user email
                const userResult = await db.select({ email: usersTable.email })
                    .from(usersTable)
                    .where(eq(usersTable.id, user.id))
                    .limit(1);
                
                const userEmail = userResult[0]?.email;

                // Create Stripe customer
                const customer = await stripe.customers.create({
                    email: userEmail,
                    metadata: {
                        user_id: user.id,
                    },
                });

                stripeCustomerId = customer.id;
                await subscriptionsRepository.setStripeCustomerId(user.id, stripeCustomerId);
            }

            // Determine if we have a proper Stripe price ID or need to use price_data
            const isPriceId = plan.stripePriceId && plan.stripePriceId.startsWith('price_');
            
            // Build line items - use price ID if available, otherwise create price inline
            const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = isPriceId
                ? [{ price: plan.stripePriceId, quantity: 1 }]
                : [{
                    price_data: {
                        currency: plan.currency.toLowerCase(),
                        product_data: {
                            name: `Match - Abonnement ${plan.name}`,
                            description: plan.description,
                        },
                        unit_amount: plan.price * 100, // Stripe uses cents
                        recurring: {
                            interval: plan.interval,
                            interval_count: plan.intervalCount,
                        },
                    },
                    quantity: 1,
                }];

            // Create Checkout Session
            const session = await stripe.checkout.sessions.create({
                customer: stripeCustomerId,
                payment_method_types: ['card'],
                mode: 'subscription',
                line_items: lineItems,
                success_url: `${CHECKOUT_URLS.SUCCESS}&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: CHECKOUT_URLS.CANCEL,
                metadata: {
                    user_id: user.id,
                    plan_id: plan_id,
                    venue_id: venue_id || '',
                },
                subscription_data: {
                    metadata: {
                        user_id: user.id,
                        plan_id: plan_id,
                        venue_id: venue_id || '',
                    },
                },
                allow_promotion_codes: true,
            });

            return ctx.json({
                checkout_url: session.url,
                session_id: session.id,
            });

        } catch (error: any) {
            console.error("Stripe checkout error:", error);
            return ctx.json({ 
                error: "Failed to create checkout session",
                details: error.message 
            }, 500);
        }
    });

    /**
     * GET /subscriptions/me
     * Returns current user's subscription
     */
    readonly getMySubscription = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get('user');
        if (!user || !user.id) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        try {
            const subscription = await subscriptionsRepository.getSubscriptionByUserId(user.id);

            if (!subscription) {
                return ctx.json({ subscription: null });
            }

            // Get plan details
            const planId = subscription.plan === 'pro' ? 'annual' : 'monthly';
            const plan = getPlanById(planId);

            // Check if user can cancel (commitment period)
            const now = new Date();
            const commitmentEnd = subscription.commitment_end_date ? new Date(subscription.commitment_end_date) : null;
            const canCancel = !commitmentEnd || now >= commitmentEnd;

            return ctx.json({
                subscription: {
                    id: subscription.id,
                    plan: subscription.plan,
                    status: subscription.status,
                    current_period_start: subscription.current_period_start,
                    current_period_end: subscription.current_period_end,
                    auto_renew: subscription.auto_renew,
                    price: subscription.price,
                    currency: subscription.currency,
                    canceled_at: subscription.canceled_at,
                    commitment_end_date: subscription.commitment_end_date,
                    can_cancel: canCancel,
                    plan_details: plan ? {
                        name: plan.name,
                        features: plan.features,
                    } : null,
                },
            });

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
        const user = ctx.get('user');
        if (!user || !user.id) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        if (!isStripeConfigured()) {
            return ctx.json({ error: "Payment system not configured" }, 503);
        }

        try {
            const stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(user.id);

            if (!stripeCustomerId) {
                return ctx.json({ error: "No payment profile found" }, 404);
            }

            // Create Stripe Customer Portal session
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: stripeCustomerId,
                return_url: CHECKOUT_URLS.SUCCESS.replace('?checkout=success', ''),
            });

            return ctx.json({ portal_url: portalSession.url });

        } catch (error: any) {
            console.error("Update payment method error:", error);
            return ctx.json({ error: "Failed to create portal session" }, 500);
        }
    });

    /**
     * POST /subscriptions/me/cancel
     * Cancels the user's subscription (at period end)
     * Note: Cannot cancel before commitment_end_date (1-year minimum engagement)
     */
    readonly cancelSubscription = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get('user');
        if (!user || !user.id) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        try {
            const subscription = await subscriptionsRepository.getSubscriptionByUserId(user.id);

            if (!subscription) {
                return ctx.json({ error: "No active subscription found" }, 404);
            }

            if (subscription.status === 'canceled') {
                return ctx.json({ error: "Subscription already canceled" }, 400);
            }

            // Check commitment period (1-year minimum engagement)
            if (subscription.commitment_end_date) {
                const now = new Date();
                const commitmentEnd = new Date(subscription.commitment_end_date);
                
                if (now < commitmentEnd) {
                    const remainingMonths = Math.ceil((commitmentEnd.getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000));
                    return ctx.json({ 
                        error: "Cannot cancel during commitment period",
                        message: `Votre engagement de 12 mois se termine le ${commitmentEnd.toLocaleDateString('fr-FR')}. Il reste ${remainingMonths} mois avant de pouvoir résilier.`,
                        commitment_end_date: commitmentEnd,
                        can_cancel_at: commitmentEnd,
                    }, 403);
                }
            }

            // Cancel in Stripe (at period end)
            if (isStripeConfigured() && subscription.stripe_subscription_id && !subscription.stripe_subscription_id.startsWith('mock_') && !subscription.stripe_subscription_id.startsWith('pending_')) {
                await stripe.subscriptions.update(subscription.stripe_subscription_id, {
                    cancel_at_period_end: true,
                });
            }

            // Update local record
            await subscriptionsRepository.updateSubscription(subscription.id, {
                auto_renew: false,
                canceled_at: new Date(),
            });

            return ctx.json({ 
                success: true,
                message: "Subscription will be canceled at the end of the billing period",
                cancel_at: subscription.current_period_end,
            });

        } catch (error: any) {
            console.error("Cancel subscription error:", error);
            return ctx.json({ error: "Failed to cancel subscription" }, 500);
        }
    });

    /**
     * POST /subscriptions/me/upgrade
     * Upgrades/changes the subscription plan
     */
    readonly upgradeSubscription = this.factory.createHandlers(validator('json', (value, c) => {
        const schema = z.object({
            plan_id: z.enum(['monthly', 'annual']),
        });
        const parsed = schema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid request" }, 400);
        }
        return parsed.data;
    }), async (ctx) => {
        const user = ctx.get('user');
        if (!user || !user.id) {
            return ctx.json({ error: "Unauthorized" }, 401);
        }

        const { plan_id } = ctx.req.valid('json');
        const newPlan = getPlanById(plan_id);

        if (!newPlan || !newPlan.stripePriceId) {
            return ctx.json({ error: "Invalid plan" }, 400);
        }

        try {
            const subscription = await subscriptionsRepository.getSubscriptionByUserId(user.id);

            if (!subscription) {
                return ctx.json({ error: "No active subscription found" }, 404);
            }

            // Update in Stripe
            if (isStripeConfigured() && subscription.stripe_subscription_id && !subscription.stripe_subscription_id.startsWith('mock_')) {
                const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
                const subscriptionItemId = stripeSubscription.items.data[0]?.id;
                
                if (subscriptionItemId) {
                    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
                        items: [
                            {
                                id: subscriptionItemId,
                                price: newPlan.stripePriceId,
                            },
                        ],
                        proration_behavior: 'create_prorations',
                    });
                }
            }

            // Update local record
            const updatedPlan = plan_id === 'annual' ? 'pro' : 'basic';
            await subscriptionsRepository.updateSubscription(subscription.id, {
                plan: updatedPlan,
                price: String(newPlan.price),
            });

            return ctx.json({ 
                success: true,
                message: `Subscription upgraded to ${newPlan.name}`,
            });

        } catch (error: any) {
            console.error("Upgrade subscription error:", error);
            return ctx.json({ error: "Failed to upgrade subscription" }, 500);
        }
    });

    /**
     * POST /subscriptions/mock (Development only)
     * Toggles mock subscription for testing
     */
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
            const existing = await subscriptionsRepository.getSubscriptionByUserId(user.id);

            if (existing) {
                await subscriptionsRepository.updateSubscription(existing.id, {
                    status: 'active',
                    current_period_end: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                });
            } else {
                await subscriptionsRepository.createSubscription({
                    user_id: user.id,
                    plan: 'pro',
                    status: 'active',
                    current_period_start: new Date(),
                    current_period_end: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                    stripe_subscription_id: `mock_sub_${Date.now()}`,
                    stripe_payment_method_id: `mock_pm_${Date.now()}`,
                    price: "30.00"
                });
            }
            return ctx.json({ message: "Mock subscription activated" });
        } else {
            const existing = await subscriptionsRepository.getSubscriptionByUserId(user.id);
            if (existing) {
                await subscriptionsRepository.deleteSubscription(existing.id);
            }
            return ctx.json({ message: "Mock subscription deactivated" });
        }
    });
}

export default SubscriptionsController;
