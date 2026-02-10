import { Hono } from "hono";
import AnalyticsController from "./analytics.controller";
import { AnalyticsLogic } from "./analytics.logic";
import { AnalyticsRepository } from "../../repository/analytics.repository";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";

/**
 * Service for defining Analytics routes.
 * Mounted at /venues/:venueId/analytics
 * All endpoints require authentication and venue ownership.
 */
class AnalyticsService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller: AnalyticsController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const analyticsRepo = new AnalyticsRepository();
        const analyticsLogic = new AnalyticsLogic(analyticsRepo);
        this.controller = new AnalyticsController(analyticsLogic);
        this.initRoutes();
    }

    private initRoutes() {
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