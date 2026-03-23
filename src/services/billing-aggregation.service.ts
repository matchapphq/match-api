import { ReservationRepository } from "../repository/reservation.repository";
import stripe from "../config/stripe";
import Stripe from "stripe";
import { CommissionBillingService } from "./commission-billing.service";
import { createHash } from "crypto";
import { COMMISSION_RATE_DEFAULT } from "../config/billing";

function isLastDayOfMonth(date: Date) {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    return nextDay.getMonth() !== date.getMonth();
}

function toBillingPeriod(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${month}`;
}

function buildReservationBatchHash(reservationIds: string[]) {
    const normalized = [...reservationIds].sort().join(",");
    return createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

interface MonthlyOwnerGroup {
    ownerId: string;
    stripeCustomerId: string | null;
    reservationIds: string[];
    totalGuests: number;
    totalAmountInCents: number;
}

export class BillingAggregationService {
    private readonly reservationRepo = new ReservationRepository();
    private readonly commissionBillingService = new CommissionBillingService();

    private async resolvePaymentMethodId(stripeCustomerId: string) {
        const customer = await stripe.customers.retrieve(stripeCustomerId, {
            expand: ["invoice_settings.default_payment_method"],
        });

        if ("deleted" in customer && customer.deleted) {
            return null;
        }

        const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
        if (defaultPaymentMethod) {
            if (typeof defaultPaymentMethod === "string") {
                return defaultPaymentMethod;
            }

            return defaultPaymentMethod.id;
        }

        const [cards, sepaDebits] = await Promise.all([
            stripe.paymentMethods.list({
                customer: stripeCustomerId,
                type: "card",
                limit: 1,
            }),
            stripe.paymentMethods.list({
                customer: stripeCustomerId,
                type: "sepa_debit",
                limit: 1,
            }),
        ]);

        return cards.data[0]?.id || sepaDebits.data[0]?.id || null;
    }

    /**
     * Aggregates all unbilled check-ins and charges venue owners once at month end.
     */
    async processMonthlyBilling() {
        const now = new Date();
        if (!isLastDayOfMonth(now)) {
            console.log("[BillingAggregation] Not the last day of month. Skipping run.");
            return {
                processed: 0,
                chargedOwners: 0,
                failedOwners: 0,
                pendingOwners: 0,
                skippedOwners: 0,
                skipped: true,
            };
        }

        const billingPeriod = toBillingPeriod(now);
        console.log(`[BillingAggregation] Starting monthly billing process for period ${billingPeriod}...`);

        // 1. Get all unbilled check-ins
        const unbilled = await this.reservationRepo.getUnbilledCheckedInReservations();

        if (unbilled.length === 0) {
            console.log("[BillingAggregation] No unbilled reservations found.");
            return {
                processed: 0,
                chargedOwners: 0,
                failedOwners: 0,
                pendingOwners: 0,
                skippedOwners: 0,
                skipped: false,
            };
        }

        // 2. Group by venue owner
        const groups = new Map<string, MonthlyOwnerGroup>();

        for (const item of unbilled) {
            const ownerId = item.owner_id;
            if (!ownerId) {
                continue;
            }

            const partySize = Number(item.party_size || 0);
            const commissionRate = Number(item.commission_rate || COMMISSION_RATE_DEFAULT);
            const reservationAmountInCents = Math.round(partySize * commissionRate * 100);

            const group = groups.get(ownerId) || {
                ownerId,
                stripeCustomerId: item.stripe_customer_id || null,
                reservationIds: [],
                totalGuests: 0,
                totalAmountInCents: 0,
            };

            if (!group.stripeCustomerId && item.stripe_customer_id) {
                group.stripeCustomerId = item.stripe_customer_id;
            }

            group.reservationIds.push(item.reservation_id);
            group.totalGuests += partySize;
            group.totalAmountInCents += reservationAmountInCents;
            groups.set(ownerId, group);
        }

        let totalProcessed = 0;
        let chargedOwners = 0;
        let failedOwners = 0;
        let pendingOwners = 0;
        let skippedOwners = 0;

        // 3. Charge each owner once for the full monthly commission.
        for (const data of groups.values()) {
            if (!data.stripeCustomerId) {
                skippedOwners += 1;
                console.warn(`[BillingAggregation] Missing Stripe customer for owner ${data.ownerId}. Skipping.`);
                continue;
            }

            if (data.totalAmountInCents <= 0) {
                skippedOwners += 1;
                console.warn(`[BillingAggregation] Computed amount is zero for owner ${data.ownerId}. Skipping.`);
                continue;
            }

            try {
                const paymentMethodId = await this.resolvePaymentMethodId(data.stripeCustomerId);
                if (!paymentMethodId) {
                    skippedOwners += 1;
                    console.warn(`[BillingAggregation] No payment method found for owner ${data.ownerId}. Skipping.`);
                    continue;
                }

                const paymentIntent = await stripe.paymentIntents.create({
                    amount: data.totalAmountInCents,
                    currency: "eur",
                    customer: data.stripeCustomerId,
                    payment_method: paymentMethodId,
                    off_session: true,
                    confirm: true,
                    metadata: {
                        type: "monthly_commission",
                        venue_owner_id: data.ownerId,
                        total_guests: String(data.totalGuests),
                        reservation_count: String(data.reservationIds.length),
                        billing_period: billingPeriod,
                    },
                    description: `Commission ${billingPeriod}`,
                }, {
                    idempotencyKey: `monthly-commission-${data.ownerId}-${billingPeriod}-${buildReservationBatchHash(data.reservationIds)}`,
                });

                await this.commissionBillingService.recordCommissionPaymentPending({
                    stripeTransactionId: paymentIntent.id,
                    userId: data.ownerId,
                    amountInCents: data.totalAmountInCents,
                    currency: paymentIntent.currency,
                    reservationIds: data.reservationIds,
                    totalGuests: data.totalGuests,
                    billingPeriod,
                    description: `Commission ${billingPeriod}`,
                    source: "monthly_job",
                });

                if (paymentIntent.status === "succeeded") {
                    await this.commissionBillingService.recordPaymentIntentSucceededFromStripe(
                        paymentIntent,
                        "monthly_job",
                    );
                    totalProcessed += data.reservationIds.length;
                    chargedOwners += 1;
                    continue;
                }

                if (
                    paymentIntent.status === "requires_payment_method"
                    || paymentIntent.status === "requires_action"
                    || paymentIntent.status === "canceled"
                ) {
                    await this.commissionBillingService.recordCommissionPaymentFailed({
                        stripeTransactionId: paymentIntent.id,
                        userId: data.ownerId,
                        amountInCents: data.totalAmountInCents,
                        currency: paymentIntent.currency,
                        reservationIds: data.reservationIds,
                        totalGuests: data.totalGuests,
                        billingPeriod,
                        description: `Commission ${billingPeriod}`,
                        failedReason: `Stripe status ${paymentIntent.status}`,
                        source: "monthly_job",
                    });
                    failedOwners += 1;
                    continue;
                }

                pendingOwners += 1;
                console.log(`[BillingAggregation] PaymentIntent ${paymentIntent.id} is ${paymentIntent.status}. Waiting for webhook finalization.`);
            } catch (error: any) {
                const paymentIntent = (error?.raw?.payment_intent || error?.payment_intent) as Stripe.PaymentIntent | undefined;

                if (paymentIntent?.id) {
                    await this.commissionBillingService.recordCommissionPaymentFailed({
                        stripeTransactionId: paymentIntent.id,
                        userId: data.ownerId,
                        amountInCents: data.totalAmountInCents,
                        currency: paymentIntent.currency || "eur",
                        reservationIds: data.reservationIds,
                        totalGuests: data.totalGuests,
                        billingPeriod,
                        description: `Commission ${billingPeriod}`,
                        failedReason: error?.message || "Stripe payment failed",
                        source: "monthly_job",
                    });
                }

                failedOwners += 1;
                console.error(`[BillingAggregation] Failed to charge owner ${data.ownerId}:`, error?.message || error);
            }
        }

        console.log(`[BillingAggregation] Process completed. Reservations billed: ${totalProcessed}`);
        return {
            processed: totalProcessed,
            chargedOwners,
            failedOwners,
            pendingOwners,
            skippedOwners,
            skipped: false,
        };
    }
}
