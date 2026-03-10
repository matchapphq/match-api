import type Stripe from "stripe";
import { BillingRepository } from "../repository/billing.repository";
import { ReservationRepository } from "../repository/reservation.repository";
import type { Transaction } from "../config/db/billing.table";

type CommissionSource = "monthly_job" | "legacy_checkin" | "webhook";

interface CommissionNotesPayload {
    source: CommissionSource;
    reservation_ids: string[];
    total_guests: number;
    billing_period: string | null;
}

interface CommissionPaymentBase {
    stripeTransactionId: string;
    userId: string;
    amountInCents: number;
    currency?: string;
    reservationIds?: string[];
    totalGuests?: number;
    billingPeriod?: string | null;
    description?: string;
    source: CommissionSource;
}

interface CommissionPaymentSuccessInput extends CommissionPaymentBase {
    paidAt?: Date;
    pdfUrl?: string | null;
}

interface CommissionPaymentPendingInput extends CommissionPaymentBase {}

interface CommissionPaymentFailedInput extends CommissionPaymentBase {
    failedReason?: string;
}

const UNIQUE_VIOLATION_CODE = "23505";

function toAmountString(amountInCents: number) {
    return (amountInCents / 100).toFixed(2);
}

function toDateString(date: Date) {
    return date.toISOString().split("T")[0]!;
}

function normalizeCurrency(currency?: string) {
    return (currency || "EUR").toUpperCase();
}

function sanitizeInvoiceToken(token: string) {
    return token.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 42);
}

function buildCommissionInvoiceNumber(stripeTransactionId: string) {
    return `COM-${sanitizeInvoiceToken(stripeTransactionId)}`;
}

function parseNotes(notes: string | null | undefined): CommissionNotesPayload | null {
    if (!notes) {
        return null;
    }

    try {
        const parsed = JSON.parse(notes) as Partial<CommissionNotesPayload>;
        if (!parsed || !Array.isArray(parsed.reservation_ids)) {
            return null;
        }

        return {
            source: (parsed.source as CommissionSource) || "webhook",
            reservation_ids: parsed.reservation_ids.filter((value): value is string => typeof value === "string"),
            total_guests: Number(parsed.total_guests || 0),
            billing_period: typeof parsed.billing_period === "string" ? parsed.billing_period : null,
        };
    } catch {
        return null;
    }
}

function toNotes(source: CommissionSource, reservationIds: string[], totalGuests: number, billingPeriod?: string | null) {
    const payload: CommissionNotesPayload = {
        source,
        reservation_ids: Array.from(new Set(reservationIds)),
        total_guests: totalGuests,
        billing_period: billingPeriod || null,
    };
    return JSON.stringify(payload);
}

function computeResolvedData(input: CommissionPaymentBase, existing: Transaction | null | undefined) {
    const existingNotes = parseNotes(existing?.notes);
    const reservationIds = Array.from(new Set(
        (input.reservationIds && input.reservationIds.length > 0)
            ? input.reservationIds
            : existingNotes?.reservation_ids || [],
    ));
    const totalGuests = input.totalGuests ?? existingNotes?.total_guests ?? reservationIds.length;
    const billingPeriod = input.billingPeriod ?? existingNotes?.billing_period ?? null;
    const description = input.description
        || existing?.description
        || (billingPeriod
            ? `Commission ${billingPeriod}`
            : "Commission payment");

    return {
        reservationIds,
        totalGuests,
        billingPeriod,
        description,
    };
}

export class CommissionBillingService {
    private readonly billingRepo = new BillingRepository();
    private readonly reservationRepo = new ReservationRepository();

    private async createOrUpdateCommissionTransaction(
        input: CommissionPaymentBase,
        status: "pending" | "completed" | "failed",
        extra: {
            completedAt?: Date | null;
            failedReason?: string | null;
        } = {},
    ) {
        const existing = await this.billingRepo.getTransactionByStripeTransactionId(input.stripeTransactionId);
        const resolved = computeResolvedData(input, existing);
        const amount = toAmountString(input.amountInCents);
        const currency = normalizeCurrency(input.currency);
        const notes = toNotes(
            input.source,
            resolved.reservationIds,
            resolved.totalGuests,
            resolved.billingPeriod,
        );

        const updatePayload: Partial<Transaction> = {
            user_id: input.userId,
            type: "commission",
            status,
            amount,
            currency,
            description: resolved.description,
            notes,
            failed_reason: status === "failed" ? (extra.failedReason || "Commission payment failed") : null,
            completed_at: status === "completed" ? (extra.completedAt || new Date()) : null,
        };

        if (existing) {
            if (existing.status === "completed" && status !== "completed") {
                return existing;
            }

            const updated = await this.billingRepo.updateTransaction(existing.id, updatePayload);
            return updated || existing;
        }

        try {
            return await this.billingRepo.createTransaction({
                user_id: input.userId,
                type: "commission",
                status,
                amount,
                currency,
                stripe_transaction_id: input.stripeTransactionId,
                description: resolved.description,
                notes,
                failed_reason: status === "failed" ? (extra.failedReason || "Commission payment failed") : null,
                completed_at: status === "completed" ? (extra.completedAt || new Date()) : null,
            });
        } catch (error: any) {
            if (error?.code !== UNIQUE_VIOLATION_CODE) {
                throw error;
            }

            const raced = await this.billingRepo.getTransactionByStripeTransactionId(input.stripeTransactionId);
            if (!raced) {
                throw error;
            }

            const updated = await this.billingRepo.updateTransaction(raced.id, updatePayload);
            return updated || raced;
        }
    }

    private async ensureCommissionInvoice(input: CommissionPaymentSuccessInput) {
        const invoiceNumber = buildCommissionInvoiceNumber(input.stripeTransactionId);
        const existing = await this.billingRepo.getInvoiceByNumber(invoiceNumber);
        if (existing) {
            return existing;
        }

        const existingTransaction = await this.billingRepo.getTransactionByStripeTransactionId(input.stripeTransactionId);
        const resolved = computeResolvedData(input, existingTransaction);
        const issuedAt = input.paidAt || new Date();
        const totalAmount = Number(toAmountString(input.amountInCents));
        const quantity = resolved.totalGuests > 0 ? resolved.totalGuests : 1;
        const unitPrice = Number((totalAmount / quantity).toFixed(2));
        const description = resolved.billingPeriod
            ? `Commission ${resolved.billingPeriod}`
            : "Commission payment";

        return await this.billingRepo.createInvoice({
            user_id: input.userId,
            invoice_number: invoiceNumber,
            status: "paid",
            issue_date: toDateString(issuedAt),
            due_date: toDateString(issuedAt),
            paid_date: toDateString(issuedAt),
            subtotal: totalAmount.toFixed(2),
            tax: "0.00",
            total: totalAmount.toFixed(2),
            description,
            items: [
                {
                    description: "Commission per checked-in guest",
                    quantity,
                    unit_price: unitPrice,
                    total: totalAmount,
                },
            ],
            pdf_url: input.pdfUrl || null,
        });
    }

    async recordCommissionPaymentPending(input: CommissionPaymentPendingInput) {
        return await this.createOrUpdateCommissionTransaction(input, "pending");
    }

    async recordCommissionPaymentSucceeded(input: CommissionPaymentSuccessInput) {
        const transaction = await this.createOrUpdateCommissionTransaction(
            input,
            "completed",
            { completedAt: input.paidAt || new Date() },
        );

        const invoice = await this.ensureCommissionInvoice(input);

        if (!transaction.invoice_id || transaction.invoice_id !== invoice.id) {
            await this.billingRepo.attachInvoiceToTransaction(transaction.id, invoice.id);
        }

        const notes = parseNotes(transaction.notes);
        const reservationIds = notes?.reservation_ids || [];
        if (reservationIds.length > 0) {
            await this.reservationRepo.markAsBilled(reservationIds);
        }

        return { transactionId: transaction.id, invoiceId: invoice.id };
    }

    async recordCommissionPaymentFailed(input: CommissionPaymentFailedInput) {
        return await this.createOrUpdateCommissionTransaction(
            input,
            "failed",
            { failedReason: input.failedReason || "Commission payment failed" },
        );
    }

    async recordPaymentIntentSucceededFromStripe(pi: Stripe.PaymentIntent, fallbackSource: CommissionSource = "webhook") {
        const userId = pi.metadata?.venue_owner_id;
        const type = pi.metadata?.type;
        if (!userId || !type) {
            return;
        }

        const stripeTransactionId = pi.id;
        const amountInCents = pi.amount_received || pi.amount || 0;
        const currency = normalizeCurrency(pi.currency);
        const billingPeriod = pi.metadata?.billing_period || null;
        let reservationIds = pi.metadata?.reservation_id ? [pi.metadata.reservation_id] : undefined;
        const totalGuests = pi.metadata?.total_guests ? Number(pi.metadata.total_guests) : undefined;

        if ((!reservationIds || reservationIds.length === 0) && type === "monthly_commission") {
            const cutoff = new Date((pi.created || Math.floor(Date.now() / 1000)) * 1000);
            reservationIds = await this.reservationRepo.getUnbilledCheckedInReservationIdsByOwner(userId, cutoff);
        }

        await this.recordCommissionPaymentSucceeded({
            stripeTransactionId,
            userId,
            amountInCents,
            currency,
            reservationIds,
            totalGuests,
            billingPeriod,
            description: type === "monthly_commission"
                ? `Commission ${billingPeriod || "monthly"}`
                : "Commission payment",
            source: fallbackSource,
        });
    }

    async recordPaymentIntentFailedFromStripe(pi: Stripe.PaymentIntent, fallbackSource: CommissionSource = "webhook") {
        const userId = pi.metadata?.venue_owner_id;
        const type = pi.metadata?.type;
        if (!userId || !type) {
            return;
        }

        const stripeTransactionId = pi.id;
        const amountInCents = pi.amount || 0;
        const currency = normalizeCurrency(pi.currency);
        const billingPeriod = pi.metadata?.billing_period || null;
        let reservationIds = pi.metadata?.reservation_id ? [pi.metadata.reservation_id] : undefined;
        const totalGuests = pi.metadata?.total_guests ? Number(pi.metadata.total_guests) : undefined;

        if ((!reservationIds || reservationIds.length === 0) && type === "monthly_commission") {
            const cutoff = new Date((pi.created || Math.floor(Date.now() / 1000)) * 1000);
            reservationIds = await this.reservationRepo.getUnbilledCheckedInReservationIdsByOwner(userId, cutoff);
        }

        await this.recordCommissionPaymentFailed({
            stripeTransactionId,
            userId,
            amountInCents,
            currency,
            reservationIds,
            totalGuests,
            billingPeriod,
            description: type === "monthly_commission"
                ? `Commission ${billingPeriod || "monthly"}`
                : "Commission payment",
            failedReason: pi.last_payment_error?.message || "Stripe payment failed",
            source: fallbackSource,
        });
    }
}
