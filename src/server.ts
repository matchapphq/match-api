import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";


import AuthService from "./services/auth/auth.service";
import UserService from "./services/user/user.service"; // Renamed from ProfileService
import OnboardingService from "./services/onboarding/onboarding.service";
import DiscoveryService from "./services/discovery/discovery.service";
import VenueService from "./services/venues/venues.service";
import MatchesService from "./services/matches/matches.service";
import SportsService from "./services/sports/sports.service";
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

const app = new Hono();

const authRouter = new AuthService();
const userRouter = new UserService();
const onboardingRouter = new OnboardingService();
const discoveryRouter = new DiscoveryService();
const venueRouter = new VenueService();
const matchesRouter = new MatchesService();
const sportsRouter = new SportsService();
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

app.use(logger());
app.use(prettyJSON());

// Auth Middleware (Populates user in context if valid token present)
// app.use("/*", authMiddleware);

// Mount routes
// Base: /api is usually handled by the entry point or Nginx, but here we assume app is mounted at /api or root. 
// If root, routes are /auth, /users, etc.
app.route("/auth", authRouter.getRouter);
app.route("/users", userRouter.getRouter); // Replaces /profile for user-centric routes
app.route("/onboarding", onboardingRouter.getRouter);
app.route("/discovery", discoveryRouter.getRouter);
app.route("/venues", venueRouter.getRouter);
app.route("/matches", matchesRouter.getRouter);
app.route("/sports", sportsRouter.getRouter);
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

export default app;