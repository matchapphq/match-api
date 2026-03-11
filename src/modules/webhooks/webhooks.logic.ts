import Stripe from "stripe";
import stripe, { STRIPE_WEBHOOK_SECRET } from "../../config/stripe";
import subscriptionsRepository from "../../repository/subscriptions.repository";
import { PartnerRepository } from "../../repository/partner/partner.repository";
import boostRepository from "../../repository/boost.repository";
import referralRepository from "../../repository/referral.repository";
import { CommissionBillingService } from "../../services/commission-billing.service";

export class WebhooksLogic {
    private readonly partnerRepository = new PartnerRepository();
    private readonly commissionBillingService = new CommissionBillingService();

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
        } catch (_err: any) {
            throw new Error("INVALID_SIGNATURE");
        }

        console.log(`Stripe webhook received: ${event.type}`);

        try {
            switch (event.type) {
                case "checkout.session.completed": {
                    const session = event.data.object as Stripe.Checkout.Session;
                    if (session.metadata?.type === "boost_purchase") {
                        await this.handleBoostPurchaseCompleted(session);
                    } else {
                        await this.handleCheckoutCompleted(session);
                    }
                    break;
                }

                case "invoice.paid":
                    await this.handleCommissionInvoiceLifecycle(event.data.object as Stripe.Invoice, "invoice.paid");
                    break;

                case "invoice.finalized":
                    await this.handleCommissionInvoiceLifecycle(event.data.object as Stripe.Invoice, "invoice.finalized");
                    break;

                case "invoice.updated":
                    await this.handleCommissionInvoiceLifecycle(event.data.object as Stripe.Invoice, "invoice.updated");
                    break;

                case "invoice.payment_failed":
                    await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
                    break;

                case "payment_intent.succeeded":
                    await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
                    break;

                case "payment_intent.payment_failed":
                    await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
                    break;

                case "customer.subscription.updated":
                case "customer.subscription.deleted":
                    console.log(`[Webhook] Ignoring legacy subscription event ${event.type}.`);
                    break;

                default:
                    console.log(`Unhandled Stripe event type: ${event.type}`);
            }

            return { received: true };
        } catch (error: any) {
            console.error(`Error handling Stripe event ${event.type}:`, error);
            return { received: true, error: error.message };
        }
    }

    private async handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
        const type = pi.metadata?.type;
        if (type !== "guest_commission" && type !== "monthly_commission") {
            return;
        }

        await this.commissionBillingService.recordPaymentIntentSucceededFromStripe(pi, "webhook");
        console.log(`[Webhook] Commission payment succeeded: ${pi.id} (${type}).`);
    }

    private async handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
        const type = pi.metadata?.type;
        if (type !== "guest_commission" && type !== "monthly_commission") {
            return;
        }

        await this.commissionBillingService.recordPaymentIntentFailedFromStripe(pi, "webhook");
        console.error(`[Webhook] Commission payment failed: ${pi.id} (${type}) owner=${pi.metadata?.venue_owner_id || "unknown"}`);
    }

    private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
        console.log("Processing checkout.session.completed:", session.id);

        const userId = session.metadata?.user_id;
        const stripeCustomerId = session.customer as string | null;

        if (!userId) {
            console.error("Missing user_id in checkout session metadata");
            return;
        }

        if (stripeCustomerId) {
            await subscriptionsRepository.setStripeCustomerId(userId, stripeCustomerId);
            console.log(`Saved stripe_customer_id ${stripeCustomerId} for user ${userId}`);
        }

        if (session.mode === "setup") {
            const activatedVenues = await this.partnerRepository.activatePendingVenuesByOwner(userId);
            if (activatedVenues.length > 0) {
                console.log(`Activated ${activatedVenues.length} pending venue(s) for user ${userId}`);
            }
            await this.maybeConvertReferral(userId, "checkout.session.completed(setup)");
            return;
        }

        console.log(`[Webhook] Ignoring non-setup checkout session ${session.id} (mode=${session.mode || "unknown"}).`);
    }

    private async handleCommissionInvoiceLifecycle(invoice: Stripe.Invoice, eventType: string) {
        const synced = await this.commissionBillingService.syncCommissionInvoiceFromStripeInvoice(invoice, "webhook");
        if (synced) {
            console.log(`[Webhook] Commission invoice synced from ${eventType}: ${invoice.id}`);
            return;
        }

        console.log(`[Webhook] Ignoring ${eventType} for non-commission invoice ${invoice.id}.`);
    }

    private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
        const synced = await this.commissionBillingService.syncCommissionInvoiceFromStripeInvoice(invoice, "webhook");
        if (synced) {
            console.log(`[Webhook] Commission invoice payment failed synced: ${invoice.id}`);
            return;
        }

        console.log(`[Webhook] Ignoring invoice.payment_failed for non-commission invoice ${invoice.id}.`);
    }

    private async handleBoostPurchaseCompleted(session: Stripe.Checkout.Session) {
        const purchaseId = session.metadata?.purchase_id;
        const userId = session.metadata?.user_id;

        if (!purchaseId || !userId) return;

        const purchase = await boostRepository.getPurchaseById(purchaseId);
        if (!purchase) return;

        if (purchase.payment_status === "paid") return;

        await boostRepository.updatePurchase(purchaseId, {
            payment_status: "paid",
            payment_intent_id: session.payment_intent as string,
            stripe_customer_id: session.customer as string,
            paid_at: new Date(),
        });

        await boostRepository.createBoostsFromPurchase(
            purchaseId,
            userId,
            purchase.quantity,
            "stripe_payment",
        );
    }
}
