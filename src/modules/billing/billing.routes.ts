import { Hono } from "hono";
import BillingController from "./billing.controller";
import { BillingLogic } from "./billing.logic";
import { BillingRepository } from "../../repository/billing.repository";
import { authMiddleware } from "../../middleware/auth.middleware";

/**
 * Service for defining Billing routes.
 */
class BillingService {
    private readonly router = new Hono();
    private readonly controller: BillingController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const billingRepo = new BillingRepository();
        const billingLogic = new BillingLogic(billingRepo);
        this.controller = new BillingController(billingLogic);
        this.initRoutes();
    }

    private initRoutes() {
        this.router.use("/invoices/*", authMiddleware);
        this.router.use("/transactions/*", authMiddleware);
        
        // Invoices
        this.router.get("/invoices", authMiddleware, ...this.controller.getInvoices);
        this.router.get("/invoices/:invoiceId", ...this.controller.getInvoiceDetails);
        this.router.get("/invoices/:invoiceId/pdf", ...this.controller.getInvoicePdf);

        // Transactions
        this.router.get("/transactions", authMiddleware, ...this.controller.getTransactions);
        this.router.get("/transactions/:transactionId", ...this.controller.getTransactionDetails);
    }
}

export default BillingService;
