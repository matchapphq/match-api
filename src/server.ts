import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth.middleware";


import AuthService from "./services/auth/auth.service";
import UserService from "./services/user/user.service";
import DiscoveryService from "./services/discovery/discovery.service";
import VenueService from "./services/venues/venues.service";
import MatchesService from "./services/matches/matches.service";
import SportsService from "./services/sports/sports.service";
import LeaguesService from "./services/leagues/leagues.service";
import TeamsService from "./services/teams/teams.service";
import ReservationsService from "./services/reservations/reservations.service";
import SeatsService from "./services/seats/seats.service";
import PartnerService from "./services/partner/partner.service";

// New Services
import ReviewsService from "./services/reviews/reviews.service";
import NotificationsService from "./services/notifications/notifications.service";
import MessagingService from "./services/messaging/messaging.service";
import SubscriptionsService from "./services/subscriptions/subscriptions.service";
import BillingService from "./services/billing/billing.service";
import AnalyticsService from "./services/analytics/analytics.service";
import CouponsService from "./services/coupons/coupons.service";
import WebhooksService from "./services/webhooks/webhooks.service";
import ReferralService from "./services/referral/referral.service";
import BoostService from "./services/boost/boost.service";
import fidelityService from "./services/fidelity/fidelity.service";
import HealthService from "./services/health/health.service";

const authRouter = new AuthService();
const userRouter = new UserService();
const discoveryRouter = new DiscoveryService();
const venueRouter = new VenueService();
const matchesRouter = new MatchesService();
const sportsRouter = new SportsService();
const leaguesRouter = new LeaguesService();
const teamsRouter = new TeamsService();
const reservationsRouter = new ReservationsService();
const seatsRouter = new SeatsService();
const partnerRouter = new PartnerService();

// New Service Instances
const reviewsRouter = new ReviewsService();
const notificationsRouter = new NotificationsService();
const messagingRouter = new MessagingService();
const subscriptionsRouter = new SubscriptionsService();
const billingRouter = new BillingService();
const analyticsRouter = new AnalyticsService();
const couponsRouter = new CouponsService();
const webhooksRouter = new WebhooksService();
const referralRouter = new ReferralService();
const boostRouter = new BoostService();
const healthRouter = new HealthService();

const app = new Hono().basePath("/api");

// CORS - must be first (with credentials for cookies)
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', "matchapp.fr", process.env.VPS_URL as string],
  credentials: true,
}));

app.use(logger());
app.route("/health", healthRouter.getRouter);

// Auth Middleware for protected routes

app.use('/partners/*', authMiddleware);
app.use('/users/*', authMiddleware);
app.use('/reservations/*', authMiddleware);
app.use('/fidelity/*', authMiddleware);

// Mount routes
// Base: /api is usually handled by the entry point or Nginx, but here we assume app is mounted at /api or root. 
// If root, routes are /auth, /users, etc.
app.route("/auth", authRouter.getRouter);
app.route("/users", userRouter.getRouter); // Replaces /profile for user-centric routes
app.route("/discovery", discoveryRouter.getRouter);
app.route("/venues", venueRouter.getRouter);
// Global amenities route (public) - direct DB query
app.get("/amenities", async (c) => {
    try {
        const { VenueRepository } = await import("./repository/venue.repository");
        const venueRepository = new VenueRepository();
        const amenities = await venueRepository.getAllAmenities();
        
        // Group by category
        const categories: Record<string, { slug: string; name: string; amenities: string[] }> = {};
        for (const amenity of amenities) {
            if (!categories[amenity.category]) {
                categories[amenity.category] = {
                    slug: amenity.category,
                    name: amenity.category.charAt(0).toUpperCase() + amenity.category.slice(1),
                    amenities: [],
                };
            }
            categories[amenity.category]!.amenities.push(amenity.id);
        }
        
        return c.json({ amenities, categories: Object.values(categories) });
    } catch (error) {
        console.error("Get all amenities error:", error);
        return c.json({ error: "Failed to fetch amenities" }, 500);
    }
});
app.route("/matches", matchesRouter.getRouter);
app.route("/sports", sportsRouter.getRouter);
app.route("/leagues", leaguesRouter.getRouter);
app.route("/teams", teamsRouter.getRouter);
app.route("/reservations", reservationsRouter.getRouter);
app.route("/partners", partnerRouter.getRouter);

// Mounting new routes
app.route("/reviews", reviewsRouter.getRouter); // Direct review actions
app.route("/notifications", notificationsRouter.getRouter);
app.route("/webhooks", webhooksRouter.getRouter);
app.route("/coupons", couponsRouter.getRouter);

// Messaging (Conversations & Messages)
// Can be mounted at separate roots or typically messaging or conversations
// API Docs: /api/conversations, /api/messages
// We can mount messagingRouter at / and let it handle both if defined there, 
// OR mount at / and prefix in service.
// Service definitions:
// this.router.post("/conversations", ...)
// this.router.put("/messages/:messageId", ...)
// So mounting at "/" works best to capture both /conversations and /messages from one service,
// or we mount at /api (parent) context. Use "" for now.
app.route("/", messagingRouter.getRouter);

// Subscriptions (Venue Owners)
app.route("/subscriptions", subscriptionsRouter.getRouter);

// Invoices & Transactions
// Service has /invoices, /transactions
// Mount at root to capture both
app.route("/", billingRouter.getRouter);

// Venue Analytics
// Docs: /api/venues/:venueId/analytics/...
// Service has /overview, /reservations, /revenue
// Mount at /venues/:venueId/analytics
app.route("/venues/:venueId/analytics", analyticsRouter.getRouter);

// Seats
// Docs: /api/venues/:venueId/seats
// Also /api/matches/:matchId/seat-holds (Seat Holds Routes)
// SeatService seems to have been existing. Let's ensure it handles both or check if we need to split.
// Assuming SeatService was correctly implemented for /venues/:venueId/matches/:matchId/seats previously
// Now we strictly want /venues/:venueId/seats
app.route("/venues/:venueId/seats", seatsRouter.getRouter);
// Note: if SeatService defines "/" as get seats, this works.

// Referral System (for venue owners)
app.route("/referral", referralRouter.getRouter);

// Boost System (for venue owners)
app.route("/boosts", boostRouter.getRouter);

// Fidelity System (loyalty points, badges, challenges)
app.route("/fidelity", fidelityService);

export default app;