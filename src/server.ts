import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth.middleware";


import AuthService from "./modules/auth/auth.routes";
import DiscoveryService from "./modules/discovery/discovery.routes";
import SportsService from "./modules/sports/sports.routes"; // Consolidated Sports/Leagues/Teams
import MatchesService from "./modules/matches/matches.routes";
import PartnerService from "./modules/partner/partner.routes";
import ReservationsService from "./modules/reservations/reservations.routes";
import UserService from "./modules/user/user.routes";
import VenueService from "./modules/venues/venues.routes";

// New Services
import AnalyticsService from "./modules/analytics/analytics.routes";
import BillingService from "./modules/billing/billing.routes";
import BoostService from "./modules/boost/boost.routes";
import CouponsService from "./modules/coupons/coupons.routes";
import FidelityService from "./modules/fidelity/fidelity.routes";
import HealthService from "./modules/health/health.routes";
import MessagingService from "./modules/messaging/messaging.routes";
import NotificationsService from "./modules/notifications/notifications.routes";
import ReferralService from "./modules/referral/referral.routes";
import ReviewsService from "./modules/reviews/reviews.routes";
import SubscriptionsService from "./modules/subscriptions/subscriptions.routes";
import WebhooksService from "./modules/webhooks/webhooks.routes";

const authRouter = new AuthService();
const userRouter = new UserService();
const discoveryRouter = new DiscoveryService();
const venueRouter = new VenueService();
const matchesRouter = new MatchesService();
const sportsRouter = new SportsService();
const reservationsRouter = new ReservationsService();
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
const fidelityRouter = new FidelityService();

const app = new Hono().basePath("/api");

// CORS - must be first (with credentials for cookies)
app.use('*', cors({
    origin: [
        'http://localhost:3000',
        'https://matchapp.fr',
        'http://matchapp.fr',
        'http://localhost:5173',
        'matchapp.fr',
        process.env.FRONTEND_URL as string
    ],
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
// Sports router now handles /sports, /leagues, /teams (if mounted at root)
// But to keep paths clean, we will mount it at / and let it handle its own prefixes
app.route("/", sportsRouter.getRouter); 

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

// Referral System (for venue owners)
app.route("/referral", referralRouter.getRouter);

// Boost System (for venue owners)
app.route("/boosts", boostRouter.getRouter);

// Fidelity System (loyalty points, badges, challenges)
app.route("/fidelity", fidelityRouter.getRouter);

export default app;