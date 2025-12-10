import { Hono } from "hono";
import AnalyticsController from "../../controllers/analytics/analytics.controller";

/**
 * Service for defining Analytics routes.
 */
class AnalyticsService {
    private readonly router = new Hono();
    private readonly controller = new AnalyticsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        // These are typically venue-scoped, but if we mount at /analytics, we can't easily capture :venueId from parent if not sub-routed.
        // The API docs say: GET /api/venues/:venueId/analytics/overview
        // So this service might need to be mounted at /venues/:venueId/analytics via VenueService or server.ts hacking.
        // Hono mount: app.route('/venues/:venueId/analytics', analyticsService)

        this.router.get("/overview", ...this.controller.getVenueOverview);
        this.router.get("/reservations", ...this.controller.getReservationAnalytics);
        this.router.get("/revenue", ...this.controller.getRevenueAnalytics);
    }
}

export default AnalyticsService;
