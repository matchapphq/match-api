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
import MediaService from "./modules/media/media.routes";

// New Services
import AnalyticsService from "./modules/analytics/analytics.routes";
import BillingService from "./modules/billing/billing.routes";
import BoostService from "./modules/boost/boost.routes";
import CouponsService from "./modules/coupons/coupons.routes";
import FidelityService from "./modules/fidelity/fidelity.routes";
import HealthService from "./modules/health/health.routes";
import NotificationsService from "./modules/notifications/notifications.routes";
import ReferralService from "./modules/referral/referral.routes";
import ReviewsService from "./modules/reviews/reviews.routes";
import SupportService from "./modules/support/support.routes";
import WebhooksService from "./modules/webhooks/webhooks.routes";
import challengeRoutes from "./modules/challenge/challenge.routes";
import UserRepository from "./repository/user.repository";

// Initialize Workers
import "./workers/stripe.worker";
import "./workers/notification.worker";
import type { HonoEnv } from "./types/hono.types";

const authRouter = new AuthService();
const userRouter = new UserService();
const discoveryRouter = new DiscoveryService();
const venueRouter = new VenueService();
const matchesRouter = new MatchesService();
const sportsRouter = new SportsService();
const reservationsRouter = new ReservationsService();
const partnerRouter = new PartnerService();
const mediaRouter = new MediaService();

// New Service Instances
const reviewsRouter = new ReviewsService();
const notificationsRouter = new NotificationsService();
const billingRouter = new BillingService();
const analyticsRouter = new AnalyticsService();
const couponsRouter = new CouponsService();
const webhooksRouter = new WebhooksService();
const referralRouter = new ReferralService();
const boostRouter = new BoostService();
const healthRouter = new HealthService();
const fidelityRouter = new FidelityService();
const supportRouter = new SupportService();
const userRepository = new UserRepository();

const parsePositiveNumber = (envValue: string | undefined, fallback: number): number => {
    const parsed = Number(envValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const accountDeletionGraceDays = parsePositiveNumber(process.env.ACCOUNT_DELETION_GRACE_DAYS, 30);
const accountDeletionCleanupIntervalMs =
    parsePositiveNumber(process.env.ACCOUNT_DELETION_CLEANUP_INTERVAL_HOURS, 6) * 60 * 60 * 1000;

const runDeletedUsersCleanup = async () => {
    const cutoffDate = new Date(Date.now() - accountDeletionGraceDays * 24 * 60 * 60 * 1000);
    try {
        const purgedCount = await userRepository.purgeDeletedUsersBefore(cutoffDate);
        if (purgedCount > 0) {
            console.log(`[ACCOUNT_CLEANUP] Purged ${purgedCount} account(s) deleted before ${cutoffDate.toISOString()}`);
        }
    } catch (error) {
        console.error("[ACCOUNT_CLEANUP] Failed to purge deleted users:", error);
    }
};

void runDeletedUsersCleanup();
setInterval(() => {
    void runDeletedUsersCleanup();
}, accountDeletionCleanupIntervalMs);

const app = new Hono().basePath("/api");

// CORS - must be first (with credentials for cookies)
app.use('*', cors({
    origin: [
        'http://localhost:3000',
        'https://matchapp.fr',
        'http://matchapp.fr',
        'http://localhost:5173',
        'matchapp.fr',
        process.env.FRONTEND_URL as string,
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
app.use("/challenge/*", authMiddleware);

// Mount routes
// Base: /api is usually handled by the entry point or Nginx, but here we assume app is mounted at /api or root. 
// If root, routes are /auth, /users, etc.
app.route("/auth", authRouter.getRouter);
app.route("/users", userRouter.getRouter); // Replaces /profile for user-centric routes
app.route("/discovery", discoveryRouter.getRouter);
app.route("/venues", venueRouter.getRouter);
app.route("/media", mediaRouter.getRouter);
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
app.route("/support", supportRouter.getRouter);
app.route("/webhooks", webhooksRouter.getRouter);
app.route("/coupons", couponsRouter.getRouter);

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

// Beta Challenge System
app.route("/challenge", challengeRoutes);

export default app;
