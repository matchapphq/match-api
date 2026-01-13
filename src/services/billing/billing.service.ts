import { Hono } from "hono";
import BillingController from "../../controllers/billing/billing.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

/**
 * Service for defining Billing routes (Invoices & Transactions).
 */
class BillingService {
    private readonly router = new Hono();
    private readonly controller = new BillingController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        this.router.use("/*", authMiddleware);
        // Invoices
        this.router.get("/invoices", ...this.controller.getInvoices);
        this.router.get("/invoices/:invoiceId", ...this.controller.getInvoiceDetails);
        this.router.get("/invoices/:invoiceId/pdf", ...this.controller.getInvoicePdf);

        // Transactions
        this.router.get("/transactions", ...this.controller.getTransactions);
        this.router.get("/transactions/:transactionId", ...this.controller.getTransactionDetails);
    }
}

export default BillingService;
