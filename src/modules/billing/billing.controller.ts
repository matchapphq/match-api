import { createFactory } from "hono/factory";
import { BillingLogic } from "./billing.logic";
import type { HonoEnv } from "../../types/hono.types";

/**
 * Controller for Billing operations (Invoices, Transactions).
 */
class BillingController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly billingLogic: BillingLogic) {}

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
        const invoiceId = ctx.req.param("invoiceId");
        
        try {
            const result = await this.billingLogic.getInvoiceDetails(invoiceId, user.id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "INVOICE_NOT_FOUND") return ctx.json({ error: "Invoice not found" }, 404);
            throw error;
        }
    });

    readonly getInvoicePdf = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        const invoiceId = ctx.req.param("invoiceId");
        
        try {
            const result = await this.billingLogic.getInvoicePdf(invoiceId, user.id);
            return ctx.json(result);
        } catch (error: any) {
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
        const transactionId = ctx.req.param("transactionId");
        
        try {
            const result = await this.billingLogic.getTransactionDetails(transactionId, user.id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "TRANSACTION_NOT_FOUND") return ctx.json({ error: "Transaction not found" }, 404);
            throw error;
        }
    });
}

export default BillingController;
