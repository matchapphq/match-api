import { BillingRepository } from "../../repository/billing.repository";
import { getCommissionPricing } from "../../config/billing";
import subscriptionsRepository from "../../repository/subscriptions.repository";
import { PartnerRepository } from "../../repository/partner/partner.repository";
import Stripe from "stripe";
import { resolvePaymentMethodStateLive } from "../../utils/stripe-payment-method";

export class BillingLogic {
    private readonly partnerRepository = new PartnerRepository();

    constructor(private readonly billingRepo: BillingRepository) {}

    getPricing() {
        return getCommissionPricing();
    }

    private stripeClient: Stripe | null = null;

    private getStripeClient() {
        if (this.stripeClient) {
            return this.stripeClient;
        }

        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeSecretKey) {
            throw new Error("PAYMENT_SYSTEM_NOT_CONFIGURED");
        }

        this.stripeClient = new Stripe(stripeSecretKey, {
            apiVersion: "2025-12-15.clover",
            typescript: true,
        });

        return this.stripeClient;
    }

    private buildDefaultSuccessUrl() {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
        return `${frontendUrl}?checkout=success`;
    }

    private buildDefaultCancelUrl() {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
        return `${frontendUrl}?checkout=cancel`;
    }

    private appendQuery(url: string, params: Record<string, string>) {
        const parsedUrl = new URL(url);
        for (const [key, value] of Object.entries(params)) {
            parsedUrl.searchParams.set(key, value);
        }
        return parsedUrl
            .toString()
            .replace(encodeURIComponent("{CHECKOUT_SESSION_ID}"), "{CHECKOUT_SESSION_ID}");
    }

    private async ensureStripeCustomer(userId: string) {
        const existingCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);
        if (existingCustomerId) {
            return existingCustomerId;
        }

        const user = await subscriptionsRepository.getUserById(userId);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }

        const customer = await this.getStripeClient().customers.create({
            email: user.email,
            metadata: { user_id: userId },
        });

        await subscriptionsRepository.setStripeCustomerId(userId, customer.id);
        return customer.id;
    }

    async createSetupCheckout(
        userId: string,
        data: {
            flow?: "post_first_venue" | "manual";
            venue_id?: string;
            success_url?: string;
            cancel_url?: string;
        },
    ) {
        const flow = data.flow || "manual";
        const stripeCustomerId = await this.ensureStripeCustomer(userId);

        const successUrl = this.appendQuery(
            data.success_url || this.buildDefaultSuccessUrl(),
            {
                setup: "true",
                flow,
                session_id: "{CHECKOUT_SESSION_ID}",
            },
        );

        const cancelUrl = data.cancel_url || this.buildDefaultCancelUrl();

        const session = await this.getStripeClient().checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ["card", "sepa_debit"],
            mode: "setup",
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                user_id: userId,
                action: "setup_payment_method",
                flow,
                venue_id: data.venue_id || "",
            },
        });

        if (!session.url) {
            throw new Error("CHECKOUT_SESSION_URL_MISSING");
        }

        return {
            checkout_url: session.url,
            session_id: session.id,
        };
    }

    async getPaymentMethod(userId: string) {
        const stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);
        const state = await resolvePaymentMethodStateLive(stripeCustomerId);

        if (state.has_payment_method) {
            try {
                await this.partnerRepository.activatePendingVenuesByOwner(userId);
            } catch (error) {
                console.warn(
                    `[Billing] Unable to activate pending venues for user ${userId} after payment method detection:`,
                    error,
                );
            }
        }

        return {
            has_payment_method: state.has_payment_method,
            provider: "stripe" as const,
            ...(state.payment_method ? { payment_method: state.payment_method } : {}),
        };
    }

    async getInvoices(userId: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        return await this.billingRepo.getInvoices(userId, limit, offset);
    }

    async getInvoiceDetails(invoiceId: string, userId: string) {
        const invoice = await this.billingRepo.getInvoiceById(invoiceId, userId);
        if (!invoice) throw new Error("INVOICE_NOT_FOUND");
        return invoice;
    }

    async getInvoicePdf(invoiceId: string, userId: string) {
        const invoice = await this.billingRepo.getInvoiceById(invoiceId, userId);
        if (!invoice) throw new Error("INVOICE_NOT_FOUND");
        
        if (invoice.pdf_url) {
            return { url: invoice.pdf_url };
        }
        
        // If no PDF URL, we might generate one or return a message
        // For now, return a placeholder or throw
        throw new Error("PDF_NOT_AVAILABLE");
    }

    async getTransactions(userId: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        return await this.billingRepo.getTransactions(userId, limit, offset);
    }

    async getTransactionDetails(transactionId: string, userId: string) {
        const transaction = await this.billingRepo.getTransactionById(transactionId, userId);
        if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
        return transaction;
    }

    async getAccruedCommission(userId: string) {
        return await this.billingRepo.getUnbilledUsage(userId);
    }
}
