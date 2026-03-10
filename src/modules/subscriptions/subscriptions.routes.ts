import { Hono } from "hono";
import SubscriptionsController from "./subscriptions.controller";
import { SubscriptionsLogic } from "./subscriptions.logic";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";

/**
 * Service for defining Subscription routes.
 */
class SubscriptionsService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller: SubscriptionsController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const subscriptionsLogic = new SubscriptionsLogic();
        this.controller = new SubscriptionsController(subscriptionsLogic);
        this.initRoutes();
    }

    private initRoutes() {
        // Public route - no auth required
        this.router.get("/plans", ...this.controller.getPlans);
        
        // Protected routes - require authentication
        this.router.post("/create-checkout", authMiddleware, ...this.controller.createCheckout);
        this.router.post("/create-setup-session", authMiddleware, ...this.controller.createSetupSession);
        this.router.get("/me", authMiddleware, ...this.controller.getMySubscription);
        this.router.post("/me/update-payment-method", authMiddleware, ...this.controller.updatePaymentMethod);
        this.router.post("/me/cancel", authMiddleware, ...this.controller.cancelSubscription);
        this.router.post("/me/upgrade", authMiddleware, ...this.controller.upgradeSubscription);
        this.router.get("/invoices", authMiddleware, ...this.controller.getMyInvoices);

        // Mock Subscription Toggle (Development only)
        this.router.post("/mock", authMiddleware, ...this.controller.mockSubscription);
    }
}

export default SubscriptionsService;