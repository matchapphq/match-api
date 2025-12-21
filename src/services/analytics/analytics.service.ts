import { Hono } from "hono";
import AnalyticsController from "../../controllers/analytics/analytics.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";

/**
 * Service for defining Analytics routes.
 * Mounted at /venues/:venueId/analytics
 * All endpoints require authentication and venue ownership.
 */
class AnalyticsService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller = new AnalyticsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        // All analytics routes require authentication
        this.router.use("/*", authMiddleware);

        // Dashboard overview
        this.router.get("/overview", ...this.controller.getVenueOverview);
        
        // Reservation trends
        this.router.get("/reservations", ...this.controller.getReservationAnalytics);
        
        // Revenue/occupancy trends
        this.router.get("/revenue", ...this.controller.getRevenueAnalytics);
    }
}

export default AnalyticsService;
