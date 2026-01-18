import { Hono } from "hono";
import ReferralController from "../../controllers/referral/referral.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

/**
 * Service for defining Referral routes.
 * Handles referral codes, stats, history, and boost management for venue owners.
 */
class ReferralService {
    private readonly router = new Hono();
    private readonly controller = new ReferralController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        // Public routes (for signup flow)
        this.router.post("/validate", ...this.controller.validateCode);

        // Protected routes (require authentication)
        this.router.use("/*", authMiddleware);

        // Referral code management
        this.router.get("/code", ...this.controller.getCode);
        this.router.get("/stats", ...this.controller.getStats);
        this.router.get("/history", ...this.controller.getHistory);

        // Referral registration (called during signup)
        this.router.post("/register", ...this.controller.registerReferral);

        // Referral conversion (called after first payment - internal/webhook)
        this.router.post("/convert", ...this.controller.convertReferral);

        // Boost management
        this.router.get("/boosts", ...this.controller.getBoosts);
        this.router.post("/boosts/:boostId/use", ...this.controller.useBoost);
    }
}

export default ReferralService;
