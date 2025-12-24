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
        this.router.post("/plans", ...this.controller.getPlans);
        this.router.post("/create-checkout", ...this.controller.createCheckout);
        this.router.get("/me", ...this.controller.getMySubscription);
        this.router.post("/me/update-payment-method", ...this.controller.updatePaymentMethod);
        this.router.post("/me/cancel", ...this.controller.cancelSubscription);
        this.router.post("/me/upgrade", ...this.controller.upgradeSubscription);

        // Mock Subscription Toggle
        this.router.post("/mock", authMiddleware, ...this.controller.mockSubscription);
    }
}

export default SubscriptionsService;
