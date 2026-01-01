import { Hono } from "hono";
import SubscriptionsController from "../../controllers/subscriptions/subscriptions.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";

/**
 * Service for defining Subscription routes.
 */
class SubscriptionsService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller = new SubscriptionsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        // Public route - no auth required
        this.router.get("/plans", ...this.controller.getPlans);
        
        // Protected routes - require authentication
        this.router.post("/create-checkout", authMiddleware, ...this.controller.createCheckout);
        this.router.get("/me", authMiddleware, ...this.controller.getMySubscription);
        this.router.post("/me/update-payment-method", authMiddleware, ...this.controller.updatePaymentMethod);
        this.router.post("/me/cancel", authMiddleware, ...this.controller.cancelSubscription);
        this.router.post("/me/upgrade", authMiddleware, ...this.controller.upgradeSubscription);

        // Mock Subscription Toggle (Development only)
        this.router.post("/mock", authMiddleware, ...this.controller.mockSubscription);
    }
}

export default SubscriptionsService;
