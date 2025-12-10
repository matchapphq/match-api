import { createFactory } from "hono/factory";

/**
 * Controller for Billing operations (Invoices, Transactions).
 */
class BillingController {
    private readonly factory = createFactory();

    // Invoices
    readonly getInvoices = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get invoices" });
    });

    readonly getInvoiceDetails = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get invoice details" });
    });

    readonly getInvoicePdf = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get invoice PDF" });
    });

    // Transactions
    readonly getTransactions = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get transactions" });
    });

    readonly getTransactionDetails = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get transaction details" });
    });
}

export default BillingController;
