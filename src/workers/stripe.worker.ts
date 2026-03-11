import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import type { StripeJobPayload } from "../types/jobs.type";
import Stripe from "stripe";
import stripe from "../config/stripe";
import subscriptionsRepository from "../repository/subscriptions.repository";
import { PartnerRepository } from "../repository/partner/partner.repository";
import boostRepository from "../repository/boost.repository";
import referralRepository from "../repository/referral.repository";
import { CommissionBillingService } from "../services/commission-billing.service";

const commissionBillingService = new CommissionBillingService();

/**
 * Worker for processing Stripe events queued asynchronously.
 * Commission-only model: setup checkout + commission payments + boosts.
 */
const stripeWorker = new Worker<StripeJobPayload>("stripe", async (job: Job<StripeJobPayload>) => {
    const payload = job.data;
    console.log(`[Stripe Worker] Processing job type ${payload.type} (Job ID: ${job.id})`);

    try {
        if (payload.type === "process_commission" && payload.commissionData) {
            await handleProcessCommission(payload.commissionData);
            return;
        }

        if (payload.type === "webhook_event" && payload.data) {
            const event = payload.data;
            const eventObject = event.data.object;

            switch (event.type) {
                case "checkout.session.completed": {
                    const session = eventObject as unknown as Stripe.Checkout.Session;
                    if (session.metadata?.type === "boost_purchase") {
                        await handleBoostPurchaseCompleted(session);
                    } else {
                        await handleCheckoutCompleted(session);
                    }
                    break;
                }

                case "invoice.paid":
                    await handleCommissionInvoiceLifecycle(eventObject as unknown as Stripe.Invoice, "invoice.paid");
                    break;

                case "invoice.finalized":
                    await handleCommissionInvoiceLifecycle(eventObject as unknown as Stripe.Invoice, "invoice.finalized");
                    break;

                case "invoice.updated":
                    await handleCommissionInvoiceLifecycle(eventObject as unknown as Stripe.Invoice, "invoice.updated");
                    break;

                case "invoice.payment_failed":
                    await handleInvoicePaymentFailed(eventObject as unknown as Stripe.Invoice);
                    break;

                case "payment_intent.succeeded":
                    await commissionBillingService.recordPaymentIntentSucceededFromStripe(
                        eventObject as unknown as Stripe.PaymentIntent,
                        "webhook",
                    );
                    break;

                case "payment_intent.payment_failed":
                    await commissionBillingService.recordPaymentIntentFailedFromStripe(
                        eventObject as unknown as Stripe.PaymentIntent,
                        "webhook",
                    );
                    break;

                case "customer.subscription.updated":
                case "customer.subscription.deleted":
                    console.log(`[Stripe Worker] Ignoring legacy subscription event ${event.type}.`);
                    break;

                default:
                    console.log(`[Stripe Worker] Unhandled Stripe event type: ${event.type}`);
            }
        }
    } catch (error: any) {
        console.error(`[Stripe Worker] Error processing job ${payload.type}:`, error);
        throw error;
    }
}, { connection: redisConnection });

export async function handleProcessCommission(data: {
    reservationId: string;
    venueOwnerId: string;
    stripeCustomerId: string;
    amountInCents: number;
    currency: string;
}) {
    console.log(`[Stripe Worker] Processing commission for reservation ${data.reservationId}`);

    const reservationRepo = new (await import("../repository/reservation.repository")).ReservationRepository();

    try {
        const reservation = await reservationRepo.findById(data.reservationId);
        if (!reservation || reservation.is_billed) {
            console.log(`[Stripe Worker] Reservation ${data.reservationId} already billed or not found. Skipping.`);
            return;
        }

        const [cards, sepaDebits] = await Promise.all([
            stripe.paymentMethods.list({
                customer: data.stripeCustomerId,
                type: "card",
                limit: 1,
            }),
            stripe.paymentMethods.list({
                customer: data.stripeCustomerId,
                type: "sepa_debit",
                limit: 1,
            }),
        ]);

        const paymentMethodId = cards.data[0]?.id || sepaDebits.data[0]?.id;
        if (!paymentMethodId) {
            console.error(`[Stripe Worker] No payment method found for customer ${data.stripeCustomerId}`);
            return;
        }

        const reservationIds = [data.reservationId];
        const totalGuests = reservation.party_size || 1;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: data.amountInCents,
            currency: data.currency.toLowerCase(),
            customer: data.stripeCustomerId,
            payment_method: paymentMethodId,
            off_session: true,
            confirm: true,
            metadata: {
                reservation_id: data.reservationId,
                type: "guest_commission",
                venue_owner_id: data.venueOwnerId,
                total_guests: String(totalGuests),
            },
            description: `Commission Match - Reservation ${data.reservationId.slice(0, 8)}`,
        });

        await commissionBillingService.recordCommissionPaymentPending({
            stripeTransactionId: paymentIntent.id,
            userId: data.venueOwnerId,
            amountInCents: data.amountInCents,
            currency: paymentIntent.currency,
            reservationIds,
            totalGuests,
            description: `Commission reservation ${data.reservationId.slice(0, 8)}`,
            source: "legacy_checkin",
        });

        if (paymentIntent.status === "succeeded") {
            await commissionBillingService.recordPaymentIntentSucceededFromStripe(
                paymentIntent,
                "legacy_checkin",
            );
            console.log(`[Stripe Worker] Commission charged successfully for reservation ${data.reservationId}`);
        } else {
            console.warn(`[Stripe Worker] PaymentIntent for ${data.reservationId} ended with status: ${paymentIntent.status}`);
            if (
                paymentIntent.status === "requires_action" ||
                paymentIntent.status === "requires_payment_method" ||
                paymentIntent.status === "canceled"
            ) {
                await commissionBillingService.recordCommissionPaymentFailed({
                    stripeTransactionId: paymentIntent.id,
                    userId: data.venueOwnerId,
                    amountInCents: data.amountInCents,
                    currency: paymentIntent.currency,
                    reservationIds,
                    totalGuests,
                    description: `Commission reservation ${data.reservationId.slice(0, 8)}`,
                    failedReason: `Stripe status ${paymentIntent.status}`,
                    source: "legacy_checkin",
                });
            }
        }
    } catch (error: any) {
        const paymentIntent = (error?.raw?.payment_intent || error?.payment_intent) as Stripe.PaymentIntent | undefined;

        if (paymentIntent?.id) {
            await commissionBillingService.recordCommissionPaymentFailed({
                stripeTransactionId: paymentIntent.id,
                userId: data.venueOwnerId,
                amountInCents: data.amountInCents,
                currency: paymentIntent.currency || data.currency,
                reservationIds: [data.reservationId],
                description: `Commission reservation ${data.reservationId.slice(0, 8)}`,
                failedReason: error?.message || "Stripe payment failed",
                source: "legacy_checkin",
            });
        }

        console.error(`[Stripe Worker] Error during commission processing:`, error?.message || error);
        throw error;
    }
}

stripeWorker.on("completed", (job) => {
    console.log(`[Stripe Worker] Job ${job.id} completed successfully`);
});

stripeWorker.on("failed", (job, err) => {
    console.error(`[Stripe Worker] Job ${job?.id} failed with error ${err.message}`);
});

async function maybeConvertReferral(referredUserId: string, source: string) {
    const result = await referralRepository.convertReferral(referredUserId);

    if (result.success) {
        console.log(`[Stripe Worker] Referral converted after ${source} for user ${referredUserId}`);
        return;
    }

    if (result.error === "No active referral found") {
        return;
    }

    console.error(`[Stripe Worker] Referral conversion failed after ${source} for user ${referredUserId}:`, result.error);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    console.log("Processing checkout.session.completed:", session.id);

    const userId = session.metadata?.user_id;
    const stripeCustomerId = session.customer as string | null;
    const partnerRepository = new PartnerRepository();

    if (!userId) {
        console.error("Missing user_id in checkout session");
        return;
    }

    if (stripeCustomerId) {
        await subscriptionsRepository.setStripeCustomerId(userId, stripeCustomerId);
    }

    if (session.mode === "setup") {
        const activatedVenues = await partnerRepository.activatePendingVenuesByOwner(userId);
        if (activatedVenues.length > 0) {
            console.log(`[Stripe Worker] Activated ${activatedVenues.length} pending venue(s) for user ${userId}`);
        }
        await maybeConvertReferral(userId, "checkout.session.completed(setup)");
        return;
    }

    console.log(`[Stripe Worker] Ignoring non-setup checkout session ${session.id} (mode=${session.mode || "unknown"}).`);
}

async function handleCommissionInvoiceLifecycle(invoice: Stripe.Invoice, eventType: string) {
    const synced = await commissionBillingService.syncCommissionInvoiceFromStripeInvoice(invoice, "webhook");
    if (synced) {
        console.log(`[Stripe Worker] Commission invoice synced from ${eventType}: ${invoice.id}`);
        return;
    }

    console.log(`[Stripe Worker] Ignoring ${eventType} for non-commission invoice ${invoice.id}.`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const synced = await commissionBillingService.syncCommissionInvoiceFromStripeInvoice(invoice, "webhook");
    if (synced) {
        console.log(`[Stripe Worker] Commission invoice payment failed synced: ${invoice.id}`);
        return;
    }

    console.log(`[Stripe Worker] Ignoring invoice.payment_failed for non-commission invoice ${invoice.id}.`);
}

async function handleBoostPurchaseCompleted(session: Stripe.Checkout.Session) {
    console.log("Processing boost purchase:", session.id);

    const purchaseId = session.metadata?.purchase_id;
    const userId = session.metadata?.user_id;

    if (!purchaseId || !userId) {
        console.error("Missing purchase_id or user_id in boost checkout session");
        return;
    }

    const purchase = await boostRepository.getPurchaseById(purchaseId);
    if (!purchase) {
        console.error("Purchase not found:", purchaseId);
        return;
    }

    if (purchase.payment_status === "paid") {
        console.log("Boost purchase already processed:", purchaseId);
        return;
    }

    await boostRepository.updatePurchase(purchaseId, {
        payment_status: "paid",
        payment_intent_id: session.payment_intent as string,
        stripe_customer_id: session.customer as string,
        paid_at: new Date(),
    });

    const boostIds = await boostRepository.createBoostsFromPurchase(
        purchaseId,
        userId,
        purchase.quantity,
        "stripe_payment",
    );

    console.log(`Created ${boostIds.length} boosts for user ${userId} from purchase ${purchaseId}`);
}
