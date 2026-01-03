import { createFactory } from "hono/factory";
import Stripe from "stripe";
import stripe, { STRIPE_WEBHOOK_SECRET } from "../../config/stripe";
import subscriptionsRepository from "../../repository/subscriptions.repository";
import { PartnerRepository } from "../../repository/partner.repository";

/**
 * Webhooks Controller
 *
 * Handles incoming webhooks from external services like Stripe.
 *
 * IMPORTANT: Webhook endpoints must:
 * 1. Verify signatures to ensure authenticity
 * 2. Return 200 quickly to avoid timeouts
 * 3. Handle events idempotently (same event may be sent multiple times)
 */
class WebhooksController {
    private readonly factory = createFactory();

    /**
     * POST /webhooks/stripe
     * Handles Stripe webhook events
     *
     * Key events handled:
     * - checkout.session.completed: User completed checkout, create subscription
     * - invoice.paid: Subscription renewed successfully
     * - invoice.payment_failed: Payment failed, mark subscription past_due
     * - customer.subscription.updated: Subscription changed (upgrade/downgrade)
     * - customer.subscription.deleted: Subscription canceled
     */
    readonly handleStripeWebhook = this.factory.createHandlers(async (ctx) => {
        const signature = ctx.req.header("stripe-signature");

        if (!signature) {
            console.error("Stripe webhook: Missing signature");
            return ctx.json({ error: "Missing signature" }, 400);
        }

        if (!STRIPE_WEBHOOK_SECRET) {
            console.error("Stripe webhook: Webhook secret not configured");
            return ctx.json({ error: "Webhook not configured" }, 500);
        }

        let event: Stripe.Event;

        try {
            // Get raw body for signature verification
            const rawBody = await ctx.req.text();
            event = stripe.webhooks.constructEvent(
                rawBody,
                signature,
                STRIPE_WEBHOOK_SECRET,
            );
        } catch (err: any) {
            console.error(
                "Stripe webhook signature verification failed:",
                err.message,
            );
            return ctx.json({ error: "Invalid signature" }, 400);
        }

        console.log(`Stripe webhook received: ${event.type}`);

        try {
            switch (event.type) {
                case "checkout.session.completed":
                    await this.handleCheckoutCompleted(
                        event.data.object as Stripe.Checkout.Session,
                    );
                    break;

                case "invoice.paid":
                    await this.handleInvoicePaid(
                        event.data.object as Stripe.Invoice,
                    );
                    break;

                case "invoice.payment_failed":
                    await this.handleInvoicePaymentFailed(
                        event.data.object as Stripe.Invoice,
                    );
                    break;

                case "customer.subscription.updated":
                    await this.handleSubscriptionUpdated(
                        event.data.object as Stripe.Subscription,
                    );
                    break;

                case "customer.subscription.deleted":
                    await this.handleSubscriptionDeleted(
                        event.data.object as Stripe.Subscription,
                    );
                    break;

                default:
                    console.log(`Unhandled Stripe event type: ${event.type}`);
            }

            return ctx.json({ received: true });
        } catch (error: any) {
            console.error(`Error handling Stripe event ${event.type}:`, error);
            // Return 200 to acknowledge receipt even if processing failed
            // Stripe will retry if we return an error
            return ctx.json({ received: true, error: error.message });
        }
    });

    /**
     * Handle checkout.session.completed
     * Creates the subscription record in our database
     */
    private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
        console.log("Processing checkout.session.completed:", session.id);
        console.log("Session metadata:", session.metadata);

        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        const venueId = session.metadata?.venue_id;
        const subscriptionId = session.subscription as string;

        console.log("Parsed values:", {
            userId,
            planId,
            venueId,
            subscriptionId,
        });

        if (!userId || !subscriptionId) {
            console.error(
                "Missing user_id or subscription in checkout session",
            );
            return;
        }

        // Check if subscription already exists (idempotency)
        const existing =
            await subscriptionsRepository.getSubscriptionByStripeId(
                subscriptionId,
            );
        if (existing) {
            console.log(
                "Subscription already exists, skipping:",
                subscriptionId,
            );
            return;
        }

        // Get subscription details from Stripe
        const stripeSubscription = (await stripe.subscriptions.retrieve(
            subscriptionId,
        )) as any;
        const amount =
            stripeSubscription.items?.data?.[0]?.price?.unit_amount || 0;

        // Determine plan type based on plan_id
        const plan = planId === "annual" ? "pro" : "basic";

        // Calculate commitment end date ONLY for annual plan
        let commitmentEndDate: Date | null = null;
        if (planId === "annual") {
            commitmentEndDate = new Date();
            commitmentEndDate.setFullYear(commitmentEndDate.getFullYear() + 1);
        }

        const partnerRepository = new PartnerRepository();
        let newSubscriptionId: string | null = null;

        // If there's a venue_id, update the venue's pending subscription
        // Note: venue_id could be empty string "", so check for truthy value
        if (venueId && venueId.length > 0) {
            console.log(
                `Processing subscription for venue ${venueId} with plan: ${plan} (planId: ${planId})`,
            );

            // Get the venue to find its pending subscription
            const venue = await partnerRepository.getVenueById(venueId);

            if (venue && venue.subscription_id) {
                // Update the venue's existing pending subscription with real Stripe data
                await subscriptionsRepository.updateSubscription(
                    venue.subscription_id,
                    {
                        plan: plan,
                        status: "active",
                        current_period_start: new Date(
                            (stripeSubscription.current_period_start ||
                                Date.now() / 1000) * 1000,
                        ),
                        current_period_end: new Date(
                            (stripeSubscription.current_period_end ||
                                Date.now() / 1000) * 1000,
                        ),
                        stripe_subscription_id: subscriptionId,
                        stripe_payment_method_id:
                            (stripeSubscription.default_payment_method as string) ||
                            "unknown",
                        price: String(amount / 100),
                        auto_renew: !stripeSubscription.cancel_at_period_end,
                        commitment_end_date: commitmentEndDate,
                    },
                );
                console.log(
                    `Subscription updated for venue ${venueId} with plan ${plan}`,
                );
            } else {
                // Venue not found or no subscription - create new subscription and link
                const newSubscription =
                    await subscriptionsRepository.createSubscription({
                        user_id: userId,
                        plan: plan,
                        status: "active",
                        current_period_start: new Date(
                            (stripeSubscription.current_period_start ||
                                Date.now() / 1000) * 1000,
                        ),
                        current_period_end: new Date(
                            (stripeSubscription.current_period_end ||
                                Date.now() / 1000) * 1000,
                        ),
                        stripe_subscription_id: subscriptionId,
                        stripe_payment_method_id:
                            (stripeSubscription.default_payment_method as string) ||
                            "unknown",
                        price: String(amount / 100),
                        auto_renew: !stripeSubscription.cancel_at_period_end,
                        commitment_end_date: commitmentEndDate,
                    });
                newSubscriptionId = newSubscription.id;
                await partnerRepository.updateVenueSubscription(
                    venueId,
                    newSubscriptionId,
                );
                console.log(
                    `New subscription created and linked to venue ${venueId} with plan ${plan}`,
                );
            }
        } else {
            // No venue_id - check for pending subscription to update
            const existingSubscription =
                await subscriptionsRepository.getSubscriptionByUserId(userId);

            if (
                existingSubscription &&
                existingSubscription.stripe_subscription_id.startsWith(
                    "pending_",
                )
            ) {
                // Update the pending subscription with real Stripe data
                await subscriptionsRepository.updateSubscription(
                    existingSubscription.id,
                    {
                        plan: plan,
                        status: "active",
                        current_period_start: new Date(
                            (stripeSubscription.current_period_start ||
                                Date.now() / 1000) * 1000,
                        ),
                        current_period_end: new Date(
                            (stripeSubscription.current_period_end ||
                                Date.now() / 1000) * 1000,
                        ),
                        stripe_subscription_id: subscriptionId,
                        stripe_payment_method_id:
                            (stripeSubscription.default_payment_method as string) ||
                            "unknown",
                        price: String(amount / 100),
                        auto_renew: !stripeSubscription.cancel_at_period_end,
                        commitment_end_date: commitmentEndDate,
                    },
                );
                console.log("Pending subscription activated for user:", userId);
            } else {
                // Create new subscription in our database
                await subscriptionsRepository.createSubscription({
                    user_id: userId,
                    plan: plan,
                    status: "active",
                    current_period_start: new Date(
                        (stripeSubscription.current_period_start ||
                            Date.now() / 1000) * 1000,
                    ),
                    current_period_end: new Date(
                        (stripeSubscription.current_period_end ||
                            Date.now() / 1000) * 1000,
                    ),
                    stripe_subscription_id: subscriptionId,
                    stripe_payment_method_id:
                        (stripeSubscription.default_payment_method as string) ||
                        "unknown",
                    price: String(amount / 100),
                    auto_renew: !stripeSubscription.cancel_at_period_end,
                    commitment_end_date: commitmentEndDate,
                });
                console.log("Subscription created for user:", userId);
            }
        }
    }

    /**
     * Handle invoice.paid
     * Updates subscription period and creates invoice record
     */
    private async handleInvoicePaid(invoice: any) {
        console.log("Processing invoice.paid:", invoice.id);

        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) return;

        const subscription =
            await subscriptionsRepository.getSubscriptionByStripeId(
                subscriptionId,
            );
        if (!subscription) {
            console.log("Subscription not found for invoice:", subscriptionId);
            return;
        }

        // Get fresh subscription data from Stripe
        const stripeSubscription = (await stripe.subscriptions.retrieve(
            subscriptionId,
        )) as any;

        // Update subscription period
        await subscriptionsRepository.updateSubscriptionByStripeId(
            subscriptionId,
            {
                status: "active",
                current_period_start: new Date(
                    (stripeSubscription.current_period_start ||
                        Date.now() / 1000) * 1000,
                ),
                current_period_end: new Date(
                    (stripeSubscription.current_period_end ||
                        Date.now() / 1000) * 1000,
                ),
            },
        );

        // Create invoice record
        const invoiceNumber =
            await subscriptionsRepository.generateInvoiceNumber();
        const today = new Date().toISOString().split("T")[0]!;
        await subscriptionsRepository.createInvoice({
            user_id: subscription.user_id,
            invoice_number: invoiceNumber,
            status: "paid",
            issue_date: today,
            due_date: today,
            paid_date: today,
            subtotal: String((invoice.subtotal || 0) / 100),
            tax: String((invoice.tax || 0) / 100),
            total: String((invoice.total || 0) / 100),
            description: `Subscription payment - ${invoice.lines?.data?.[0]?.description || "Match subscription"}`,
            pdf_url: invoice.invoice_pdf || null,
        });

        console.log("Invoice recorded for subscription:", subscriptionId);
    }

    /**
     * Handle invoice.payment_failed
     * Marks subscription as past_due
     */
    private async handleInvoicePaymentFailed(invoice: any) {
        console.log("Processing invoice.payment_failed:", invoice.id);

        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) return;

        await subscriptionsRepository.updateSubscriptionByStripeId(
            subscriptionId,
            {
                status: "past_due",
            },
        );

        console.log("Subscription marked past_due:", subscriptionId);
    }

    /**
     * Handle customer.subscription.updated
     * Syncs subscription changes (plan changes, cancellation scheduled, etc.)
     */
    private async handleSubscriptionUpdated(subscription: any) {
        console.log(
            "Processing customer.subscription.updated:",
            subscription.id,
        );

        const existingSubscription =
            await subscriptionsRepository.getSubscriptionByStripeId(
                subscription.id,
            );
        if (!existingSubscription) {
            console.log("Subscription not found:", subscription.id);
            return;
        }

        // Map Stripe status to our status
        let status: "active" | "trialing" | "past_due" | "canceled" = "active";
        if (subscription.status === "past_due") status = "past_due";
        else if (subscription.status === "canceled") status = "canceled";
        else if (subscription.status === "trialing") status = "trialing";

        await subscriptionsRepository.updateSubscriptionByStripeId(
            subscription.id,
            {
                status: status,
                current_period_start: new Date(
                    (subscription.current_period_start || Date.now() / 1000) *
                        1000,
                ),
                current_period_end: new Date(
                    (subscription.current_period_end || Date.now() / 1000) *
                        1000,
                ),
                auto_renew: !subscription.cancel_at_period_end,
                canceled_at: subscription.canceled_at
                    ? new Date(subscription.canceled_at * 1000)
                    : null,
            },
        );

        console.log("Subscription updated:", subscription.id);
    }

    /**
     * Handle customer.subscription.deleted
     * Marks subscription as canceled
     */
    private async handleSubscriptionDeleted(subscription: any) {
        console.log(
            "Processing customer.subscription.deleted:",
            subscription.id,
        );

        await subscriptionsRepository.updateSubscriptionByStripeId(
            subscription.id,
            {
                status: "canceled",
                canceled_at: new Date(),
                auto_renew: false,
            },
        );

        console.log("Subscription canceled:", subscription.id);
    }
}

export default WebhooksController;
