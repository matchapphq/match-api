import { createFactory } from "hono/factory";
import { z } from "zod";
import { BillingLogic } from "./billing.logic";
import type { HonoEnv } from "../../types/hono.types";

const setupCheckoutSchema = z.object({
    flow: z.enum(["post_first_venue", "manual"]).optional(),
    venue_id: z.string().uuid().optional(),
    success_url: z.string().url().optional(),
    cancel_url: z.string().url().optional(),
});

/**
 * Controller for Billing operations (Invoices, Transactions).
 */
class BillingController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly billingLogic: BillingLogic) {}

    private getRequiredParam(ctx: any, key: string): string {
        const value = ctx.req.param(key);
        if (!value) {
            throw new Error(`MISSING_PARAM:${key}`);
        }
        return value;
    }

    readonly getPricing = this.factory.createHandlers(async (ctx) => {
        const pricing = this.billingLogic.getPricing();
        return ctx.json(pricing);
    });

    readonly createSetupCheckout = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        let payload: unknown = {};

        try {
            payload = await ctx.req.json();
        } catch {
            payload = {};
        }

        const parsed = setupCheckoutSchema.safeParse(payload ?? {});
        if (!parsed.success) {
            return ctx.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
        }

        try {
            const result = await this.billingLogic.createSetupCheckout(user.id, parsed.data);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "PAYMENT_SYSTEM_NOT_CONFIGURED") {
                return ctx.json({ error: "Payment system not configured" }, 503);
            }
            if (error.message === "USER_NOT_FOUND") {
                return ctx.json({ error: "User not found" }, 404);
            }
            if (error.message === "CHECKOUT_SESSION_URL_MISSING") {
                return ctx.json({ error: "Checkout URL unavailable" }, 502);
            }

            console.error("Create setup checkout error:", error);
            return ctx.json({ error: "Failed to create setup checkout", details: error.message }, 500);
        }
    });

    readonly getPaymentMethod = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");

        try {
            const result = await this.billingLogic.getPaymentMethod(user.id);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Get payment method error:", error);
            return ctx.json({ error: "Failed to retrieve payment method", details: error.message }, 500);
        }
    });

    // Invoices
    readonly getInvoices = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        const page = parseInt(ctx.req.query("page") || "1");
        const limit = parseInt(ctx.req.query("limit") || "20");
        
        const result = await this.billingLogic.getInvoices(user.id, page, limit);
        return ctx.json(result);
    });

    readonly getInvoiceDetails = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        const invoiceId = this.getRequiredParam(ctx, "invoiceId");
        
        try {
            const result = await this.billingLogic.getInvoiceDetails(invoiceId, user.id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "MISSING_PARAM:invoiceId") return ctx.json({ error: "Invoice ID is required" }, 400);
            if (error.message === "INVOICE_NOT_FOUND") return ctx.json({ error: "Invoice not found" }, 404);
            throw error;
        }
    });

    readonly getInvoicePdf = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        const invoiceId = this.getRequiredParam(ctx, "invoiceId");
        
        try {
            const result = await this.billingLogic.getInvoicePdf(invoiceId, user.id);
            return ctx.json(result);
        } catch (error: any) {
             if (error.message === "MISSING_PARAM:invoiceId") return ctx.json({ error: "Invoice ID is required" }, 400);
             if (error.message === "INVOICE_NOT_FOUND") return ctx.json({ error: "Invoice not found" }, 404);
             if (error.message === "PDF_NOT_AVAILABLE") return ctx.json({ error: "PDF not available" }, 404);
             throw error;
        }
    });

    // Transactions
    readonly getTransactions = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        const page = parseInt(ctx.req.query("page") || "1");
        const limit = parseInt(ctx.req.query("limit") || "20");
        
        const result = await this.billingLogic.getTransactions(user.id, page, limit);
        return ctx.json(result);
    });

    readonly getTransactionDetails = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        const transactionId = this.getRequiredParam(ctx, "transactionId");
        
        try {
            const result = await this.billingLogic.getTransactionDetails(transactionId, user.id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "MISSING_PARAM:transactionId") return ctx.json({ error: "Transaction ID is required" }, 400);
            if (error.message === "TRANSACTION_NOT_FOUND") return ctx.json({ error: "Transaction not found" }, 404);
            throw error;
        }
    });

    readonly getAccruedCommission = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        const result = await this.billingLogic.getAccruedCommission(user.id);
        return ctx.json(result);
    });
}

export default BillingController;
