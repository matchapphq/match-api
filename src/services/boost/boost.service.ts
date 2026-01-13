import { Hono } from "hono";
import BoostController from "../../controllers/boost/boost.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

/**
 * Service for defining Boost routes.
 * Handles boost purchasing, activation, and analytics for venue owners.
 */
class BoostService {
    private readonly router = new Hono();
    private readonly controller = new BoostController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        // Public route - get prices (no auth needed)
        this.router.get("/prices", ...this.controller.getPrices);

        // Protected routes (require authentication)
        this.router.use("/*", authMiddleware);

        // Available boosts
        this.router.get("/available", ...this.controller.getAvailable);

        // Stats and summary
        this.router.get("/stats", ...this.controller.getStats);
        this.router.get("/summary", ...this.controller.getSummary);

        // Purchase flow
        this.router.post("/purchase/create-checkout", ...this.controller.createCheckout);
        this.router.post("/purchase/verify", ...this.controller.verifyPurchase);
        this.router.get("/purchases", ...this.controller.getPurchaseHistory);

        // Boostable matches
        this.router.get("/boostable/:venueId", ...this.controller.getBoostableMatches);

        // Boost activation/deactivation
        this.router.post("/activate", ...this.controller.activateBoost);
        this.router.post("/deactivate", ...this.controller.deactivateBoost);

        // History and analytics
        this.router.get("/history", ...this.controller.getHistory);
        this.router.get("/analytics/:boostId", ...this.controller.getAnalytics);
    }
}

export default BoostService;
