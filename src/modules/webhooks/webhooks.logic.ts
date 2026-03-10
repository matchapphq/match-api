import Stripe from "stripe";
import stripe, { STRIPE_WEBHOOK_SECRET } from "../../config/stripe";
import subscriptionsRepository from "../../repository/subscriptions.repository";
import { PartnerRepository } from "../../repository/partner/partner.repository";
import boostRepository from "../../repository/boost.repository";
import referralRepository from "../../repository/referral.repository";
import UserRepository from "../../repository/user.repository";
import { geocodeAddress } from "../../utils/geocoding";
import { queueEmailIfAllowed } from "../../services/mail-dispatch.service";
import { EmailType } from "../../types/mail.types";

export class WebhooksLogic {
    private readonly userRepository = new UserRepository();
    private readonly partnerRepository = new PartnerRepository();

    private async maybeConvertReferral(referredUserId: string, source: string) {
        const result = await referralRepository.convertReferral(referredUserId);

        if (result.success) {
            console.log(`Referral converted after ${source} for user ${referredUserId}`);
            return;
        }

        if (result.error === "No active referral found") {
            return;
        }

        console.error(`Referral conversion failed after ${source} for user ${referredUserId}:`, result.error);
    }

    async handleStripeWebhook(signature: string, rawBody: string) {
        if (!STRIPE_WEBHOOK_SECRET) throw new Error("WEBHOOK_NOT_CONFIGURED");

        let event: Stripe.Event;

        try {
            event = await stripe.webhooks.constructEventAsync(
                rawBody,
                signature,
                STRIPE_WEBHOOK_SECRET,
            );
        } catch (err: any) {
            throw new Error("INVALID_SIGNATURE");
        }

        console.log(`Stripe webhook received: ${event.type}`);

        try {
            switch (event.type) {
                case "checkout.session.completed":
                    const session = event.data.object as Stripe.Checkout.Session;
                    if (session.metadata?.type === 'boost_purchase') {
                        await this.handleBoostPurchaseCompleted(session);
                    } else {
                        await this.handleCheckoutCompleted(session);
                    }
                    break;

                case "invoice.paid":
                    await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
                    break;

                case "invoice.payment_failed":
                    await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
                    break;

                case "customer.subscription.updated":
                    await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                    break;

                case "customer.subscription.deleted":
                    await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                    break;

                case "payment_intent.succeeded":
                    await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
                    break;

                case "payment_intent.payment_failed":
                    await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
                    break;

                default:
                    console.log(`Unhandled Stripe event type: ${event.type}`);
            }

            return { received: true };
        } catch (error: any) {
            console.error(`Error handling Stripe event ${event.type}:`, error);
            // Return success to Stripe to prevent retries of bad events, but log error
            return { received: true, error: error.message };
        }
    }

    /**
     * Handle successful payment intents.
     * This is critical for SEPA and other async methods where success happens days later.
     */
    private async handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
        const { reservation_id, type } = pi.metadata;

        if (type === 'guest_commission' && reservation_id) {
            console.log(`[Webhook] Async payment succeeded for reservation ${reservation_id}. Marking as billed.`);
            const reservationRepo = new (await import("../../repository/reservation.repository")).ReservationRepository();
            await reservationRepo.markAsBilled([reservation_id]);
        }
    }

    /**
     * Handle failed payment intents.
     */
    private async handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
        const { reservation_id, type, venue_owner_id } = pi.metadata;

        if (type === 'guest_commission') {
            console.error(`[Webhook] Payment failed for reservation ${reservation_id}. Owner: ${venue_owner_id}`);
            // TODO: In a later step, we can queue a notification to the owner here
        }
    }

    private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
        console.log("Processing checkout.session.completed:", session.id);
        
        const userId = session.metadata?.user_id;
        const stripeCustomerId = session.customer as string;

        if (!userId) {
            console.error("Missing user_id in checkout session metadata");
            return;
        }

        // 1. Always ensure stripe_customer_id is saved on the user
        if (stripeCustomerId) {
            await subscriptionsRepository.setStripeCustomerId(userId, stripeCustomerId);
            console.log(`Saved stripe_customer_id ${stripeCustomerId} for user ${userId}`);
        }

        // 2. Handle 'setup' mode (Payment Method Only Onboarding)
        if (session.mode === 'setup') {
            const activatedVenues = await this.partnerRepository.activatePendingVenuesByOwner(userId);
            if (activatedVenues.length > 0) {
                console.log(`Activated ${activatedVenues.length} pending venue(s) for user ${userId}`);
            }
            console.log(`Setup session completed for user ${userId}. Onboarding complete.`);
            await this.maybeConvertReferral(userId, "checkout.session.completed(setup)");
            return;
        }

        // 3. Handle 'subscription' mode (Legacy/Still supported for now)
        const planId = session.metadata?.plan_id;
        const venueId = session.metadata?.venue_id;
        const venueDataStr = session.metadata?.venue_data;
        const action = session.metadata?.action;
        const subscriptionId = session.subscription as string;

        if (!subscriptionId) {
            console.warn("Checkout session completed but no subscription ID found (might be setup mode handled above)");
            return;
        }

        const existing = await subscriptionsRepository.getSubscriptionByStripeId(subscriptionId);
        if (existing) {
            console.log("Subscription already exists, skipping:", subscriptionId);
            await this.maybeConvertReferral(userId, "checkout.session.completed(existing)");
            return;
        }

        const user = await this.userRepository.getUserById(userId);
        const stripeSubscription = (await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] })) as any;
        const amount = stripeSubscription.items?.data?.[0]?.price?.unit_amount || 0;
        const plan = planId === "annual" ? "pro" : "basic";

        let commitmentEndDate: Date | null = null;
        if (planId === "annual") {
            commitmentEndDate = new Date();
            commitmentEndDate.setFullYear(commitmentEndDate.getFullYear() + 1);
        }

        if (venueId && venueId.length > 0) {
            const venue = await this.partnerRepository.getVenueById(venueId);

            if (venue && venue.subscription_id) {
                await subscriptionsRepository.updateSubscription(venue.subscription_id, {
                    plan: plan,
                    status: "active",
                    current_period_start: new Date((stripeSubscription.current_period_start || Date.now() / 1000) * 1000),
                    current_period_end: new Date((stripeSubscription.current_period_end || Date.now() / 1000) * 1000),
                    stripe_subscription_id: subscriptionId,
                    stripe_payment_method_id: (stripeSubscription.default_payment_method as string) || "unknown",
                    price: String(amount / 100),
                    auto_renew: !stripeSubscription.cancel_at_period_end,
                    commitment_end_date: commitmentEndDate,
                });
                await this.partnerRepository.updateVenueSubscriptionState(venue.subscription_id, {
                    subscription_status: "active",
                    is_active: true,
                    status: "approved",
                });

                if (user) {
                    try {
                        await queueEmailIfAllowed({
                            jobName: EmailType.VENUE_PAYMENT_SUCCESS,
                            recipientUserId: user.id,
                            isTransactional: true,
                            payload: {
                                to: user.email,
                                subject: "Confirmation de paiement - Match",
                                data: {
                                    userName: user.first_name,
                                    venueName: venue.name,
                                    amount: `${(amount / 100).toFixed(2)}€`,
                                    planName: plan === 'pro' ? 'Annuel (Pro)' : 'Mensuel (Basic)',
                                    date: new Date().toLocaleDateString('fr-FR'),
                                    invoiceUrl: stripeSubscription.latest_invoice?.invoice_pdf,
                                },
                            },
                            options: {
                                attempts: 3,
                                backoff: { type: "exponential", delay: 5000 },
                                priority: 2,
                                jobId: `payment-${subscriptionId}`,
                            },
                        });
                    } catch (err) {
                        console.error("Failed to send payment success email:", err);
                    }
                }
            } else {
                const newSubscription = await subscriptionsRepository.createSubscription({
                    user_id: userId,
                    plan: plan,
                    status: "active",
                    current_period_start: new Date((stripeSubscription.current_period_start || Date.now() / 1000) * 1000),
                    current_period_end: new Date((stripeSubscription.current_period_end || Date.now() / 1000) * 1000),
                    stripe_subscription_id: subscriptionId,
                    stripe_payment_method_id: (stripeSubscription.default_payment_method as string) || "unknown",
                    price: String(amount / 100),
                    auto_renew: !stripeSubscription.cancel_at_period_end,
                    commitment_end_date: commitmentEndDate,
                });
                await this.partnerRepository.updateVenueSubscription(venueId, newSubscription.id);
                await this.partnerRepository.updateVenueSubscriptionState(newSubscription.id, {
                    subscription_status: "active",
                    is_active: true,
                    status: "approved",
                });
            }
        } else if (action === 'create_venue' && venueDataStr) {
            try {
                const venueData = JSON.parse(venueDataStr);
                const newSubscription = await subscriptionsRepository.createSubscription({
                    user_id: userId,
                    plan: plan,
                    status: "active",
                    current_period_start: new Date((stripeSubscription.current_period_start || Date.now() / 1000) * 1000),
                    current_period_end: new Date((stripeSubscription.current_period_end || Date.now() / 1000) * 1000),
                    stripe_subscription_id: subscriptionId,
                    stripe_payment_method_id: (stripeSubscription.default_payment_method as string) || "unknown",
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
                
                const newVenue = await this.partnerRepository.createVenue({
                    name: venueData.name,
                    owner_id: userId,
                    subscription_id: newSubscription.id,
                    description: venueData.description || null,
                    street_address: venueData.street_address,
                    city: venueData.city,
                    state_province: venueData.state_province,
                    postal_code: venueData.postal_code,
                    country: venueData.country,
                    phone: venueData.phone,
                    email: venueData.email,
                    capacity: venueData.capacity,
                    type: venueData.type || 'sports_bar',
                    coords,
                });
                
                if (newVenue && user) {
                    try {
                        await queueEmailIfAllowed({
                            jobName: EmailType.VENUE_PAYMENT_SUCCESS,
                            recipientUserId: user.id,
                            isTransactional: true,
                            payload: {
                                to: user.email,
                                subject: "Confirmation de paiement - Match",
                                data: {
                                    userName: user.first_name,
                                    venueName: newVenue.name,
                                    amount: `${(amount / 100).toFixed(2)}€`,
                                    planName: plan === 'pro' ? 'Annuel (Pro)' : 'Mensuel (Basic)',
                                    date: new Date().toLocaleDateString('fr-FR'),
                                    invoiceUrl: stripeSubscription.latest_invoice?.invoice_pdf,
                                },
                            },
                            options: {
                                attempts: 3,
                                backoff: { type: "exponential", delay: 5000 },
                                priority: 2,
                                jobId: `payment-${subscriptionId}`,
                            },
                        });
                    } catch (err) {
                        console.error("Failed to send payment success email:", err);
                    }
                }
            } catch (parseError: any) {
                console.error("Error creating venue after payment:", parseError);
            }
        } else {
            const existingSubscription = await subscriptionsRepository.getSubscriptionByUserId(userId);

            if (existingSubscription && existingSubscription.stripe_subscription_id.startsWith("pending_")) {
                await subscriptionsRepository.updateSubscription(existingSubscription.id, {
                    plan: plan,
                    status: "active",
                    current_period_start: new Date((stripeSubscription.current_period_start || Date.now() / 1000) * 1000),
                    current_period_end: new Date((stripeSubscription.current_period_end || Date.now() / 1000) * 1000),
                    stripe_subscription_id: subscriptionId,
                    stripe_payment_method_id: (stripeSubscription.default_payment_method as string) || "unknown",
                    price: String(amount / 100),
                    auto_renew: !stripeSubscription.cancel_at_period_end,
                    commitment_end_date: commitmentEndDate,
                });
            } else {
                await subscriptionsRepository.createSubscription({
                    user_id: userId,
                    plan: plan,
                    status: "active",
                    current_period_start: new Date((stripeSubscription.current_period_start || Date.now() / 1000) * 1000),
                    current_period_end: new Date((stripeSubscription.current_period_end || Date.now() / 1000) * 1000),
                    stripe_subscription_id: subscriptionId,
                    stripe_payment_method_id: (stripeSubscription.default_payment_method as string) || "unknown",
                    price: String(amount / 100),
                    auto_renew: !stripeSubscription.cancel_at_period_end,
                    commitment_end_date: commitmentEndDate,
                });
            }
        }

        await this.maybeConvertReferral(userId, "checkout.session.completed");
    }

    private async handleInvoicePaid(invoice: any) {
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) return;

        const subscription = await subscriptionsRepository.getSubscriptionByStripeId(subscriptionId);
        if (!subscription) return;

        const stripeSubscription = (await stripe.subscriptions.retrieve(subscriptionId)) as any;

        await subscriptionsRepository.updateSubscriptionByStripeId(subscriptionId, {
            status: "active",
            current_period_start: new Date((stripeSubscription.current_period_start || Date.now() / 1000) * 1000),
            current_period_end: new Date((stripeSubscription.current_period_end || Date.now() / 1000) * 1000),
        });

        const invoiceNumber = await subscriptionsRepository.generateInvoiceNumber();
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

        await this.maybeConvertReferral(subscription.user_id, "invoice.paid");
    }

    private async handleInvoicePaymentFailed(invoice: any) {
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) return;

        await subscriptionsRepository.updateSubscriptionByStripeId(subscriptionId, {
            status: "past_due",
        });
    }

    private async handleSubscriptionUpdated(subscription: any) {
        const existingSubscription = await subscriptionsRepository.getSubscriptionByStripeId(subscription.id);
        if (!existingSubscription) return;
        const willRenew = !(
            subscription.cancel_at_period_end ||
            subscription.cancel_at ||
            subscription.canceled_at ||
            subscription.status === "canceled"
        );

        let status: "active" | "trialing" | "past_due" | "canceled" = "active";
        if (subscription.status === "past_due") status = "past_due";
        else if (subscription.status === "canceled") status = "canceled";
        else if (subscription.status === "trialing") status = "trialing";

        await subscriptionsRepository.updateSubscriptionByStripeId(subscription.id, {
            status: status,
            current_period_start: new Date((subscription.current_period_start || Date.now() / 1000) * 1000),
            current_period_end: new Date((subscription.current_period_end || Date.now() / 1000) * 1000),
            auto_renew: willRenew,
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        });

        if (subscription.cancel_at_period_end) {
            await this.partnerRepository.updateVenueSubscriptionState(existingSubscription.id, {
                subscription_status: status,
            });
        } else {
            await this.partnerRepository.updateVenueSubscriptionState(existingSubscription.id, {
                subscription_status: status,
                is_active: true,
                status: "approved",
            });
        }
    }

    private async handleSubscriptionDeleted(subscription: any) {
        const existingSubscription = await subscriptionsRepository.getSubscriptionByStripeId(subscription.id);
        if (!existingSubscription) return;

        await subscriptionsRepository.updateSubscriptionByStripeId(subscription.id, {
            status: "canceled",
            canceled_at: new Date(),
            auto_renew: false,
        });

        await this.partnerRepository.updateVenueSubscriptionState(existingSubscription.id, {
            subscription_status: "canceled",
            is_active: false,
            status: "suspended",
        });
    }

    private async handleBoostPurchaseCompleted(session: Stripe.Checkout.Session) {
        const purchaseId = session.metadata?.purchase_id;
        const userId = session.metadata?.user_id;

        if (!purchaseId || !userId) return;

        const purchase = await boostRepository.getPurchaseById(purchaseId);
        if (!purchase) return;

        if (purchase.payment_status === 'paid') return;

        await boostRepository.updatePurchase(purchaseId, {
            payment_status: 'paid',
            payment_intent_id: session.payment_intent as string,
            stripe_customer_id: session.customer as string,
            paid_at: new Date(),
        });

        await boostRepository.createBoostsFromPurchase(
            purchaseId,
            userId,
            purchase.quantity,
            'stripe_payment',
        );
    }
}
