import { createFactory } from "hono/factory";
import { BillingLogic } from "./billing.logic";

/**
 * Controller for Billing operations (Invoices, Transactions).
 */
class BillingController {
    private readonly factory = createFactory();

    constructor(private readonly billingLogic: BillingLogic) {}

    // Invoices
    readonly getInvoices = this.factory.createHandlers(async (ctx) => {
        const result = await this.billingLogic.getInvoices();
        return ctx.json(result);
    });

    readonly getInvoiceDetails = this.factory.createHandlers(async (ctx) => {
        const invoiceId = ctx.req.param("invoiceId");
        const result = await this.billingLogic.getInvoiceDetails(invoiceId);
        return ctx.json(result);
    });

    readonly getInvoicePdf = this.factory.createHandlers(async (ctx) => {
        const invoiceId = ctx.req.param("invoiceId");
        const result = await this.billingLogic.getInvoicePdf(invoiceId);
        return ctx.json(result);
    });

    // Transactions
    readonly getTransactions = this.factory.createHandlers(async (ctx) => {
        const result = await this.billingLogic.getTransactions();
        return ctx.json(result);
    });

    readonly getTransactionDetails = this.factory.createHandlers(async (ctx) => {
        const transactionId = ctx.req.param("transactionId");
        const result = await this.billingLogic.getTransactionDetails(transactionId);
        return ctx.json(result);
    });
}

export default BillingController;