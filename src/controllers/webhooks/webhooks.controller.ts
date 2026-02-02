import { createFactory } from "hono/factory";
import Stripe from "stripe";
import stripe, { STRIPE_WEBHOOK_SECRET } from "../../config/stripe";
import subscriptionsRepository from "../../repository/subscriptions.repository";
import { PartnerRepository } from "../../repository/partner.repository";
import boostRepository from "../../repository/boost.repository";
import UserRepository from "../../repository/user.repository";
import { geocodeAddress } from "../../utils/geocoding";
import { mailQueue } from "../../queue/notification.queue";
import { randomUUIDv7 } from "bun";

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
    private readonly userRepository = new UserRepository();

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
    public readonly handleStripeWebhook = this.factory.createHandlers(async (ctx) => {
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
                    const session = event.data.object as Stripe.Checkout.Session;
                    // Check if this is a boost purchase
                    if (session.metadata?.type === 'boost_purchase') {
                        await this.handleBoostPurchaseCompleted(session);
                    } else {
                        await this.handleCheckoutCompleted(session);
                    }
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
     * If action is 'create_venue', also creates the venue after payment success
     */
    private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
        console.log("Processing checkout.session.completed:", session.id);
        console.log("Session metadata:", session.metadata);

        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        const venueId = session.metadata?.venue_id;
        const venueDataStr = session.metadata?.venue_data;
        const action = session.metadata?.action;
        const subscriptionId = session.subscription as string;

        console.log("Parsed values:", {
            userId,
            planId,
            venueId,
            action,
            subscriptionId,
            hasVenueData: !!venueDataStr,
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

        // Fetch User for emails
        const user = await this.userRepository.getUserById(userId);

        // Get subscription details from Stripe
        const stripeSubscription = (await stripe.subscriptions.retrieve(
            subscriptionId,
            { expand: ['latest_invoice'] }
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

                // Send Email
                if (user) {
                    try {
                        await mailQueue.add("venue-payment-success", {
                            to: user.email,
                            subject: "Confirmation de paiement - Match",
                            data: {
                                userName: user.first_name,
                                venueName: venue.name,
                                amount: `${(amount / 100).toFixed(2)}€`,
                                planName: plan === 'pro' ? 'Annuel (Pro)' : 'Mensuel (Basic)',
                                date: new Date().toLocaleDateString('fr-FR'),
                                invoiceUrl: stripeSubscription.latest_invoice?.invoice_pdf
                            }
                        }, {
                            attempts: 3,
                            backoff: { type: "exponential", delay: 5000 },
                            priority: 2,
                            jobId: `payment-${subscriptionId}`
                        });
                    } catch (err) {
                        console.error("Failed to send payment success email:", err);
                    }
                }

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
        } else if (action === 'create_venue' && venueDataStr) {
            // Payment successful for venue creation - NOW create the venue
            console.log("Creating venue after successful payment...");
            
            try {
                const venueData = JSON.parse(venueDataStr);
                
                // First create the subscription
                const newSubscription = await subscriptionsRepository.createSubscription({
                    user_id: userId,
                    plan: plan,
                    status: "active",
                    current_period_start: new Date(
                        (stripeSubscription.current_period_start || Date.now() / 1000) * 1000,
                    ),
                    current_period_end: new Date(
                        (stripeSubscription.current_period_end || Date.now() / 1000) * 1000,
                    ),
                    stripe_subscription_id: subscriptionId,
                    stripe_payment_method_id:
                        (stripeSubscription.default_payment_method as string) || "unknown",
                    price: String(amount / 100),
                    auto_renew: !stripeSubscription.cancel_at_period_end,
                    commitment_end_date: commitmentEndDate,
                });
                
                const coords = await geocodeAddress({
                    street: venueData.street_address,
                    city: venueData.city,
                    country: venueData.country,
                    state: venueData.state_province,
                    postal_code: venueData.postal_code,
                });
                
                const { lat, lng } = coords;
                
                // Now create the venue with the subscription
                const newVenue = await partnerRepository.createVenue({
                    name: venueData.name,
                    owner_id: userId,
                    subscription_id: newSubscription.id,
                    street_address: venueData.street_address,
                    city: venueData.city,
                    state_province: venueData.state_province,
                    postal_code: venueData.postal_code,
                    country: venueData.country,
                    phone: venueData.phone,
                    email: venueData.email,
                    capacity: venueData.capacity,
                    coords: { lat, lng }
                });
                
                if (newVenue) {
                    console.log(`Venue created after payment: ${newVenue.id} - ${newVenue.name}`);
                    
                    // Send Email
                    if (user) {
                        try {
                            await mailQueue.add("venue-payment-success", {
                                to: user.email,
                                subject: "Confirmation de paiement - Match",
                                data: {
                                    userName: user.first_name,
                                    venueName: newVenue.name,
                                    amount: `${(amount / 100).toFixed(2)}€`,
                                    planName: plan === 'pro' ? 'Annuel (Pro)' : 'Mensuel (Basic)',
                                    date: new Date().toLocaleDateString('fr-FR'),
                                    invoiceUrl: stripeSubscription.latest_invoice?.invoice_pdf
                                }
                            }, {
                                attempts: 3,
                                backoff: { type: "exponential", delay: 5000 },
                                priority: 2,
                                jobId: `payment-${subscriptionId}`
                            });
                        } catch (err) {
                            console.error("Failed to send payment success email:", err);
                        }
                    }
                }
            } catch (parseError: any) {
                console.error("Error creating venue after payment:", parseError);
            }
        } else {
            // No venue_id and no create_venue action - check for pending subscription to update
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

    /**
     * Handle boost purchase checkout completed
     * Creates boost records after successful payment
     */
    private async handleBoostPurchaseCompleted(session: Stripe.Checkout.Session) {
        console.log("Processing boost purchase:", session.id);

        const purchaseId = session.metadata?.purchase_id;
        const userId = session.metadata?.user_id;
        const packType = session.metadata?.pack_type;

        if (!purchaseId || !userId) {
            console.error("Missing purchase_id or user_id in boost checkout session");
            return;
        }

        // Get the purchase record
        const purchase = await boostRepository.getPurchaseById(purchaseId);
        if (!purchase) {
            console.error("Purchase not found:", purchaseId);
            return;
        }

        // Check if already processed (idempotency)
        if (purchase.payment_status === 'paid') {
            console.log("Boost purchase already processed:", purchaseId);
            return;
        }

        // Update the purchase record
        await boostRepository.updatePurchase(purchaseId, {
            payment_status: 'paid',
            payment_intent_id: session.payment_intent as string,
            stripe_customer_id: session.customer as string,
            paid_at: new Date(),
        });

        // Create the boosts
        const boostIds = await boostRepository.createBoostsFromPurchase(
            purchaseId,
            userId,
            purchase.quantity,
            'stripe_payment'
        );

        console.log(`Created ${boostIds.length} boosts for user ${userId} from purchase ${purchaseId}`);
    }

    /**
     * Handle boost refund
     * Called when a charge is refunded for a boost purchase
     */
    private async handleBoostRefund(paymentIntentId: string) {
        console.log("Processing boost refund for payment intent:", paymentIntentId);

        const purchase = await boostRepository.getPurchaseByPaymentIntent(paymentIntentId);
        if (!purchase) {
            console.log("No boost purchase found for payment intent:", paymentIntentId);
            return;
        }

        // Mark purchase as refunded
        await boostRepository.updatePurchase(purchase.id, {
            payment_status: 'refunded',
            refunded_at: new Date(),
        });

        // Mark available boosts as expired (refunded)
        const refundedCount = await boostRepository.refundBoostsByPurchase(purchase.id);
        console.log(`Refunded ${refundedCount} boosts for purchase ${purchase.id}`);
    }
}

export default WebhooksController;
