import { Hono } from "hono";
import PartnerController from "../../controllers/partner/partner.controller";

/**
 * Service for defining Partner (Restaurant Owner) routes.
 * Mounts the PartnerController handlers to the router.
 */
class PartnerService {
    private readonly router = new Hono();
    private readonly controller = new PartnerController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        // Venues
        this.router.get("/venues", ...this.controller.getMyVenues);
        this.router.post("/venues", ...this.controller.createVenue);
        this.router.post("/venues/verify-checkout", ...this.controller.verifyCheckoutAndCreateVenue);
        
        // Venue Matches (must be before :venueId routes to avoid conflict)
        this.router.get("/venues/matches", ...this.controller.getMyMatches);
        this.router.post("/venues/:venueId/matches", ...this.controller.scheduleMatch);
        this.router.put("/venues/:venueId/matches/:matchId", ...this.controller.updateVenueMatch);
        this.router.delete("/venues/:venueId/matches/:matchId", ...this.controller.cancelMatch);
        
        // Venue Reservations
        this.router.get("/venues/:venueId/reservations", ...this.controller.getVenueReservations);
        this.router.get("/venues/:venueId/reservations/stats", ...this.controller.getReservationStats);
        
        // Venue Matches Calendar
        this.router.get("/venues/:venueId/matches/calendar", ...this.controller.getMatchesCalendar);
        
        // Venue Clients
        this.router.get("/venues/:venueId/clients", ...this.controller.getVenueClients);
        
        // Venue Subscription
        this.router.get("/venues/:venueId/subscription", ...this.controller.getVenueSubscription);
        
        // Venue Payment Portal
        this.router.post("/venues/:venueId/payment-portal", ...this.controller.getVenuePaymentPortal);
        
        // Analytics & Stats
        this.router.get("/stats/customers", ...this.controller.getCustomerStats);
        this.router.get("/analytics/summary", ...this.controller.getAnalyticsSummary);
        this.router.get("/analytics/dashboard", ...this.controller.getAnalyticsDashboard);
        this.router.get("/activity", ...this.controller.getRecentActivity);

        // Reservation Management (accept/decline PENDING reservations)
        this.router.patch("/reservations/:reservationId/status", ...this.controller.updateReservationStatus);
        this.router.patch("/reservations/:reservationId", ...this.controller.updateReservationFull);
        this.router.post("/reservations/:reservationId/mark-no-show", ...this.controller.markReservationNoShow);

        // Waitlist Management
        this.router.get("/venues/:venueId/matches/:matchId/waitlist", ...this.controller.getVenueMatchWaitlist);
        this.router.post("/waitlist/:entryId/notify", ...this.controller.notifyWaitlistCustomer);
    }
}

export default PartnerService;
