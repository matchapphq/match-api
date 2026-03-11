import type Stripe from "stripe";
import { BillingRepository } from "../repository/billing.repository";
import { ReservationRepository } from "../repository/reservation.repository";
import type { Transaction } from "../config/db/billing.table";
import stripe from "../config/stripe";

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
const INVOICE_URL_RETRY_ATTEMPTS = 5;
const INVOICE_URL_RETRY_DELAY_MS = 1200;

function toAmountString(amountInCents: number) {
    return (amountInCents / 100).toFixed(2);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

interface StripeInvoiceRecordInput {
    stripeTransactionId: string;
    stripeCustomerId: string;
    userId: string;
    amountInCents: number;
    currency: string;
    description: string;
    source: CommissionSource;
    totalGuests: number;
    reservationIds?: string[];
    billingPeriod?: string | null;
}

interface CommissionInvoiceLine {
    lineId: string;
    description: string;
    amountInCents: number;
    quantity: number;
    unitPrice: number;
    total: number;
}

export class CommissionBillingService {
    private readonly billingRepo = new BillingRepository();
    private readonly reservationRepo = new ReservationRepository();

    private async resolveStripeInvoiceUrlByPaymentIntent(stripeTransactionId: string): Promise<string | null> {
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(stripeTransactionId);
            const stripeCustomerId = typeof paymentIntent.customer === "string"
                ? paymentIntent.customer
                : (paymentIntent.customer as Stripe.Customer | null)?.id || "";

            if (!stripeCustomerId) {
                return null;
            }

            const invoices = await stripe.invoices.list({
                customer: stripeCustomerId,
                limit: 100,
            });

            const invoice = invoices.data.find(
                (item) =>
                    item.metadata?.payment_intent_id === stripeTransactionId
                    || (item as any).payment_intent === stripeTransactionId,
            );

            return invoice?.invoice_pdf || invoice?.hosted_invoice_url || null;
        } catch (error: any) {
            console.error("[CommissionBilling] Failed to resolve Stripe invoice URL by payment_intent:", error?.message || error);
            return null;
        }
    }

    private buildFallbackCommissionLine(amountInCents: number, fallbackTotalGuests: number, currency: string): CommissionInvoiceLine {
        const quantity = fallbackTotalGuests > 0 ? fallbackTotalGuests : 1;
        const total = Number((amountInCents / 100).toFixed(2));
        const unitPrice = Number((total / quantity).toFixed(2));

        return {
            lineId: "fallback",
            description: `Commission check-in - ${total.toFixed(2)} ${currency}`,
            amountInCents,
            quantity,
            unitPrice,
            total,
        };
    }

    private buildDailyLineId(dateLabel: string, venueName: string) {
        const rawKey = `${dateLabel}::${venueName}`;
        const normalizedVenue = venueName
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 30);

        const normalizedDate = dateLabel.replace(/[^0-9-]/g, "").slice(0, 10);
        let hash = 0;
        for (let index = 0; index < rawKey.length; index += 1) {
            hash = (hash * 31 + rawKey.charCodeAt(index)) % 1000000007;
        }

        return `day-${normalizedDate}-${normalizedVenue || "unknown"}-${hash.toString(36)}`;
    }

    private formatCommissionLineDescription(
        partySize: number,
        checkInDate: Date,
        venueName: string,
        amountInCents: number,
        currency: string,
        reservationCount = 1,
    ) {
        const checkInLabel = reservationCount > 1 ? "Check-ins" : "Check-in";
        const peopleLabel = partySize > 1 ? "personnes" : "personne";
        const dateLabel = toDateString(checkInDate);
        const amountLabel = (amountInCents / 100).toFixed(2);
        return `${checkInLabel} ${partySize} ${peopleLabel} ${dateLabel} - ${venueName} - ${amountLabel} ${currency}`;
    }

    private async buildCommissionInvoiceLines(
        reservationIds: string[],
        amountInCents: number,
        currency: string,
        fallbackTotalGuests: number,
    ): Promise<CommissionInvoiceLine[]> {
        if (reservationIds.length === 0) {
            return [this.buildFallbackCommissionLine(amountInCents, fallbackTotalGuests, currency)];
        }

        const billingDetails = await this.reservationRepo.getBillingDetailsByReservationIds(reservationIds);
        if (billingDetails.length === 0) {
            return [this.buildFallbackCommissionLine(amountInCents, fallbackTotalGuests, currency)];
        }

        const groupedByDayAndVenue = new Map<string, {
            lineId: string;
            checkInDate: Date;
            venueName: string;
            totalGuests: number;
            reservationCount: number;
            amountInCents: number;
        }>();

        for (const detail of billingDetails) {
            const partySize = Math.max(Number(detail.party_size || 0), 1);
            const commissionRate = Number(detail.commission_rate || "1.50");
            const normalizedCommissionRate = Number.isFinite(commissionRate) ? commissionRate : 1.5;
            const amountForReservationInCents = Math.round(partySize * normalizedCommissionRate * 100);
            const checkInDate = detail.checked_in_at
                ? new Date(detail.checked_in_at)
                : detail.created_at
                    ? new Date(detail.created_at)
                    : new Date();
            const venueName = (detail.venue_name || "").trim() || "Lieu inconnu";
            const dateLabel = toDateString(checkInDate);
            const lineId = this.buildDailyLineId(dateLabel, venueName);
            const groupingKey = `${dateLabel}::${venueName}`;
            const existingGroup = groupedByDayAndVenue.get(groupingKey);

            if (existingGroup) {
                existingGroup.totalGuests += partySize;
                existingGroup.reservationCount += 1;
                existingGroup.amountInCents += amountForReservationInCents;
                continue;
            }

            groupedByDayAndVenue.set(groupingKey, {
                lineId,
                checkInDate,
                venueName,
                totalGuests: partySize,
                reservationCount: 1,
                amountInCents: amountForReservationInCents,
            });
        }

        const lines = Array.from(groupedByDayAndVenue.values())
            .sort((a, b) => a.checkInDate.getTime() - b.checkInDate.getTime())
            .map((group): CommissionInvoiceLine => {
                const quantity = group.totalGuests > 0 ? group.totalGuests : 1;
                const total = Number((group.amountInCents / 100).toFixed(2));
                const unitPrice = Number((total / quantity).toFixed(2));

                return {
                    lineId: group.lineId,
                    description: this.formatCommissionLineDescription(
                        group.totalGuests,
                        group.checkInDate,
                        group.venueName,
                        group.amountInCents,
                        currency,
                        group.reservationCount,
                    ),
                    amountInCents: group.amountInCents,
                    quantity,
                    unitPrice,
                    total,
                };
            });

        const linesTotalInCents = lines.reduce((sum, line) => sum + line.amountInCents, 0);
        const roundingDiffInCents = amountInCents - linesTotalInCents;

        if (roundingDiffInCents !== 0) {
            const adjustmentAmount = Number((roundingDiffInCents / 100).toFixed(2));
            lines.push({
                lineId: "rounding-adjustment",
                description: `Ajustement d'arrondi commission - ${adjustmentAmount.toFixed(2)} ${currency}`,
                amountInCents: roundingDiffInCents,
                quantity: 1,
                unitPrice: adjustmentAmount,
                total: adjustmentAmount,
            });
        }

        return lines;
    }

    private async ensureStripeInvoiceRecord(input: StripeInvoiceRecordInput): Promise<string | null> {
        try {
            const invoices = await stripe.invoices.list({
                customer: input.stripeCustomerId,
                limit: 100,
            });

            let invoice = invoices.data.find(
                (item) => item.metadata?.payment_intent_id === input.stripeTransactionId,
            ) || null;

            if (!invoice) {
                invoice = await stripe.invoices.create({
                    customer: input.stripeCustomerId,
                    collection_method: "send_invoice",
                    days_until_due: 1,
                    auto_advance: false,
                    description: input.description,
                    metadata: {
                        type: "commission",
                        source: input.source,
                        venue_owner_id: input.userId,
                        payment_intent_id: input.stripeTransactionId,
                        billing_period: input.billingPeriod || "",
                        total_guests: String(input.totalGuests),
                    },
                }, {
                    idempotencyKey: `commission-invoice-${input.stripeTransactionId}`,
                });
            }

            if (invoice.status === "draft") {
                const invoiceLines = await this.buildCommissionInvoiceLines(
                    input.reservationIds || [],
                    input.amountInCents,
                    normalizeCurrency(input.currency),
                    input.totalGuests,
                );

                for (const line of invoiceLines) {
                    await stripe.invoiceItems.create({
                        customer: input.stripeCustomerId,
                        invoice: invoice.id,
                        amount: line.amountInCents,
                        currency: input.currency.toLowerCase(),
                        description: line.description,
                        metadata: {
                            payment_intent_id: input.stripeTransactionId,
                            source: input.source,
                            line_id: line.lineId,
                        },
                    }, {
                        idempotencyKey: `commission-invoice-item-${input.stripeTransactionId}-${line.lineId}`,
                    });
                }
            }

            if (invoice.status === "draft") {
                invoice = await stripe.invoices.finalizeInvoice(invoice.id, {
                    auto_advance: false,
                });
            }

            if (invoice.status !== "paid") {
                invoice = await stripe.invoices.pay(invoice.id, {
                    paid_out_of_band: true,
                });
            }

            for (let attempt = 0; attempt < INVOICE_URL_RETRY_ATTEMPTS; attempt += 1) {
                const refreshedInvoice = await stripe.invoices.retrieve(invoice.id);
                const url = refreshedInvoice.invoice_pdf || refreshedInvoice.hosted_invoice_url || null;
                if (url) {
                    return url;
                }

                if (attempt < INVOICE_URL_RETRY_ATTEMPTS - 1) {
                    await sleep(INVOICE_URL_RETRY_DELAY_MS);
                }
            }

            return invoice.invoice_pdf || invoice.hosted_invoice_url || null;
        } catch (error: any) {
            console.error("[CommissionBilling] Failed to create Stripe invoice record:", error?.message || error);
            return null;
        }
    }

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
            if (!existing.pdf_url) {
                const fallbackUrl = input.pdfUrl
                    || await this.resolveStripeInvoiceUrlByPaymentIntent(input.stripeTransactionId);

                if (fallbackUrl) {
                    const updated = await this.billingRepo.updateInvoicePdfUrl(existing.id, fallbackUrl);
                    return updated || existing;
                }
            }
            return existing;
        }

        const existingTransaction = await this.billingRepo.getTransactionByStripeTransactionId(input.stripeTransactionId);
        const resolved = computeResolvedData(input, existingTransaction);
        const issuedAt = input.paidAt || new Date();
        const totalAmount = Number(toAmountString(input.amountInCents));
        const description = resolved.billingPeriod
            ? `Commission ${resolved.billingPeriod}`
            : "Commission payment";
        const invoiceLines = await this.buildCommissionInvoiceLines(
            resolved.reservationIds,
            input.amountInCents,
            normalizeCurrency(input.currency),
            resolved.totalGuests,
        );

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
            items: invoiceLines.map((line) => ({
                description: line.description,
                quantity: line.quantity,
                unit_price: line.unitPrice,
                total: line.total,
            })),
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

        const stripeCustomerId = typeof pi.customer === "string"
            ? pi.customer
            : (pi.customer as Stripe.Customer | null)?.id || "";
        const resolvedTotalGuests = totalGuests ?? reservationIds?.length ?? 0;
        const resolvedDescription = type === "monthly_commission"
            ? `Commission ${billingPeriod || "monthly"}`
            : "Commission payment";

        const stripeInvoicePdfUrl = stripeCustomerId
            ? await this.ensureStripeInvoiceRecord({
                stripeTransactionId,
                stripeCustomerId,
                userId,
                amountInCents,
                currency,
                description: resolvedDescription,
                source: fallbackSource,
                totalGuests: resolvedTotalGuests,
                reservationIds,
                billingPeriod,
            })
            : null;

        await this.recordCommissionPaymentSucceeded({
            stripeTransactionId,
            userId,
            amountInCents,
            currency,
            reservationIds,
            totalGuests: resolvedTotalGuests,
            billingPeriod,
            description: resolvedDescription,
            pdfUrl: stripeInvoicePdfUrl,
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

    async syncCommissionInvoiceFromStripeInvoice(invoice: Stripe.Invoice, fallbackSource: CommissionSource = "webhook") {
        const stripeTransactionId = (
            (typeof (invoice as any).payment_intent === "string" && (invoice as any).payment_intent)
            || invoice.metadata?.payment_intent_id
            || ""
        );

        if (!stripeTransactionId) {
            return false;
        }

        const transaction = await this.billingRepo.getTransactionByStripeTransactionId(stripeTransactionId);
        if (!transaction || transaction.type !== "commission") {
            return false;
        }

        const notes = parseNotes(transaction.notes);
        const amountInCents = Math.round(Number(transaction.amount || 0) * 100);
        if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
            return false;
        }

        const paidAtUnix = (invoice as any)?.status_transitions?.paid_at as number | undefined;
        const paidAt = paidAtUnix
            ? new Date(paidAtUnix * 1000)
            : (transaction.completed_at || new Date());

        const invoiceRecord = await this.ensureCommissionInvoice({
            stripeTransactionId,
            userId: transaction.user_id,
            amountInCents,
            currency: transaction.currency || "EUR",
            reservationIds: notes?.reservation_ids || [],
            totalGuests: notes?.total_guests,
            billingPeriod: notes?.billing_period,
            description: transaction.description || undefined,
            source: notes?.source || fallbackSource,
            paidAt,
            pdfUrl: invoice.invoice_pdf || invoice.hosted_invoice_url || null,
        });

        if (!transaction.invoice_id || transaction.invoice_id !== invoiceRecord.id) {
            await this.billingRepo.attachInvoiceToTransaction(transaction.id, invoiceRecord.id);
        }

        return true;
    }
}
