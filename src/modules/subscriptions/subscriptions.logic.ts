import subscriptionsRepository from "../../repository/subscriptions.repository";
import UserRepository from "../../repository/user.repository";
import stripe, {
    SUBSCRIPTION_PLANS,
    CHECKOUT_URLS,
    getPlanById,
    isStripeConfigured,
} from "../../config/stripe";
import Stripe from "stripe";

export class SubscriptionsLogic {
    private readonly userRepository = new UserRepository();

    getPlans() {
        return Object.values(SUBSCRIPTION_PLANS).map((plan) => ({
            id: plan.id,
            name: plan.name,
            price: plan.price,
            currency: plan.currency,
            interval: plan.interval,
            features: plan.features,
            description: plan.description,
            pricePerMonth:
                "pricePerMonth" in plan ? plan.pricePerMonth : plan.price,
        }));
    }

    async createCheckout(userId: string, data: any) {
        if (!isStripeConfigured()) {
            throw new Error("PAYMENT_SYSTEM_NOT_CONFIGURED");
        }

        const { plan_id, venue_id, success_url, cancel_url } = data;
        const plan = getPlanById(plan_id);

        if (!plan || !plan.stripePriceId) {
            throw new Error("INVALID_PLAN");
        }

        let stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);

        if (!stripeCustomerId) {
            const userResult = await this.userRepository.getUserById(userId);
            if (!userResult) throw new Error("USER_NOT_FOUND");
            const userEmail = userResult.email;

            const customer = await stripe.customers.create({
                email: userEmail,
                metadata: {
                    user_id: userId,
                },
            });

            stripeCustomerId = customer.id;
            await subscriptionsRepository.setStripeCustomerId(userId, stripeCustomerId);
        }

        const isPriceId = plan.stripePriceId && plan.stripePriceId.startsWith("price_");

        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = isPriceId
            ? [{ price: plan.stripePriceId, quantity: 1 }]
            : [
                  {
                      price_data: {
                          currency: plan.currency.toLowerCase(),
                          product_data: {
                              name: `Match - Abonnement ${plan.name}`,
                              description: plan.description,
                          },
                          unit_amount: plan.price * 100,
                          recurring: {
                              interval: plan.interval,
                              interval_count: plan.intervalCount,
                          },
                      },
                      quantity: 1,
                  },
              ];

        const finalSuccessUrl = success_url 
            ? `${success_url}?checkout=success&session_id={CHECKOUT_SESSION_ID}` 
            : `${CHECKOUT_URLS.SUCCESS}&session_id={CHECKOUT_SESSION_ID}`;
        
        const finalCancelUrl = cancel_url || CHECKOUT_URLS.CANCEL;

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: [
                "card",
                "sepa_debit",
                "klarna"
            ],
            mode: "subscription",
            line_items: lineItems,
            success_url: finalSuccessUrl,
            cancel_url: finalCancelUrl,
            metadata: {
                user_id: userId,
                plan_id: plan_id,
                venue_id: venue_id || "",
            },
            subscription_data: {
                metadata: {
                    user_id: userId,
                    plan_id: plan_id,
                    venue_id: venue_id || "",
                },
            },
            allow_promotion_codes: true,
        });

        return {
            checkout_url: session.url,
            session_id: session.id,
        };
    }

    async getMySubscription(userId: string) {
        const subscription = await subscriptionsRepository.getSubscriptionByUserId(userId);

        if (!subscription) {
            return null;
        }

        const planId = subscription.plan === "pro" ? "annual" : "monthly";
        const plan = getPlanById(planId);

        const now = new Date();
        const commitmentEnd = subscription.commitment_end_date
            ? new Date(subscription.commitment_end_date)
            : null;
        const canCancel = !commitmentEnd || now >= commitmentEnd;

        return {
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
            plan_details: plan
                ? {
                      name: plan.name,
                      features: plan.features,
                  }
                : null,
        };
    }

    async updatePaymentMethod(userId: string) {
        if (!isStripeConfigured()) {
            throw new Error("PAYMENT_SYSTEM_NOT_CONFIGURED");
        }

        const stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);

        if (!stripeCustomerId) {
            throw new Error("NO_PAYMENT_PROFILE");
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: CHECKOUT_URLS.SUCCESS.replace("?checkout=success", ""),
        });

        return { portal_url: portalSession.url };
    }

    async cancelSubscription(userId: string) {
        const subscription = await subscriptionsRepository.getSubscriptionByUserId(userId);

        if (!subscription) {
            throw new Error("NO_ACTIVE_SUBSCRIPTION");
        }

        if (subscription.status === "canceled") {
            throw new Error("SUBSCRIPTION_ALREADY_CANCELED");
        }

        if (subscription.commitment_end_date) {
            const now = new Date();
            const commitmentEnd = new Date(subscription.commitment_end_date);

            if (now < commitmentEnd) {
                const remainingMonths = Math.ceil(
                    (commitmentEnd.getTime() - now.getTime()) /
                        (30 * 24 * 60 * 60 * 1000),
                );
                throw new Error(`COMMITMENT_PERIOD:${commitmentEnd.toLocaleDateString("fr-FR")}:${remainingMonths}`);
            }
        }

        if (
            isStripeConfigured() &&
            subscription.stripe_subscription_id &&
            !subscription.stripe_subscription_id.startsWith("mock_") &&
            !subscription.stripe_subscription_id.startsWith("pending_")
        ) {
            await stripe.subscriptions.update(
                subscription.stripe_subscription_id,
                {
                    cancel_at_period_end: true,
                },
            );
        }

        await subscriptionsRepository.updateSubscription(subscription.id, {
            auto_renew: false,
            canceled_at: new Date(),
        });

        return {
            success: true,
            message: "Subscription will be canceled at the end of the billing period",
            cancel_at: subscription.current_period_end,
        };
    }

    async upgradeSubscription(userId: string, planId: string) {
        const newPlan = getPlanById(planId);

        if (!newPlan || !newPlan.stripePriceId) {
            throw new Error("INVALID_PLAN");
        }

        const subscription = await subscriptionsRepository.getSubscriptionByUserId(userId);

        if (!subscription) {
            throw new Error("NO_ACTIVE_SUBSCRIPTION");
        }

        if (
            isStripeConfigured() &&
            subscription.stripe_subscription_id &&
            !subscription.stripe_subscription_id.startsWith("mock_")
        ) {
            const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
            const subscriptionItemId = stripeSubscription.items.data[0]?.id;

            if (subscriptionItemId) {
                await stripe.subscriptions.update(
                    subscription.stripe_subscription_id,
                    {
                        items: [
                            {
                                id: subscriptionItemId,
                                price: newPlan.stripePriceId,
                            },
                        ],
                        proration_behavior: "create_prorations",
                    },
                );
            }
        }

        const updatedPlan = planId === "annual" ? "pro" : "basic";
        await subscriptionsRepository.updateSubscription(
            subscription.id,
            {
                plan: updatedPlan,
                price: String(newPlan.price),
            },
        );

        return {
            success: true,
            message: `Subscription upgraded to ${newPlan.name}`,
        };
    }

    async getMyInvoices(userId: string) {
        return await subscriptionsRepository.getInvoicesByUserId(userId);
    }

    async mockSubscription(userId: string, status: string) {
        if (status === "active") {
            const existing = await subscriptionsRepository.getSubscriptionByUserId(userId);

            if (existing) {
                await subscriptionsRepository.updateSubscription(
                    existing.id,
                    {
                        status: "active",
                        current_period_end: new Date(
                            new Date().setFullYear(
                                new Date().getFullYear() + 1,
                            ),
                        ),
                    },
                );
            } else {
                await subscriptionsRepository.createSubscription({
                    user_id: userId,
                    plan: "pro",
                    status: "active",
                    current_period_start: new Date(),
                    current_period_end: new Date(
                        new Date().setFullYear(
                            new Date().getFullYear() + 1,
                        ),
                    ),
                    stripe_subscription_id: `mock_sub_${Date.now()}`,
                    stripe_payment_method_id: `mock_pm_${Date.now()}`,
                    price: "30.00",
                });
            }
            return { message: "Mock subscription activated" };
        } else {
            const existing = await subscriptionsRepository.getSubscriptionByUserId(userId);
            if (existing) {
                await subscriptionsRepository.deleteSubscription(existing.id);
            }
            return { message: "Mock subscription deactivated" };
        }
    }
}
