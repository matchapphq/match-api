import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

import AuthService from "./services/auth/auth.service";
import OnboardingService from "./services/onboarding/onboarding.service";
import DiscoveryService from "./services/discovery/discovery.service";
import VenueService from "./services/venues/venues.service";
import MatchesService from "./services/matches/matches.service";
import SportsService from "./services/sports/sports.service";
import ReservationsService from "./services/reservations/reservations.service";
import SeatsService from "./services/seats/seats.service";
import ProfileService from "./services/profile/profile.service";
import PartnerService from "./services/partner/partner.service";

const app = new Hono();

const authRouter = new AuthService();
const onboardingRouter = new OnboardingService();
const discoveryRouter = new DiscoveryService();
const venueRouter = new VenueService();
const matchesRouter = new MatchesService();
const sportsRouter = new SportsService();
const reservationsRouter = new ReservationsService();
const seatsRouter = new SeatsService();
const profileRouter = new ProfileService();
const partnerRouter = new PartnerService();

app.use(logger());
app.use(prettyJSON());

// Mount routes
app.route("/auth", authRouter.getRouter);
app.route("/onboarding", onboardingRouter.getRouter);
app.route("/discovery", discoveryRouter.getRouter);
app.route("/venues", venueRouter.getRouter);
app.route("/matches", matchesRouter.getRouter);
app.route("/sports", sportsRouter.getRouter);
app.route("/reservations", reservationsRouter.getRouter);
// Note: Seats are mounted under /venues/:venueId/matches/:matchId/seats usually, but here we mounted just the service.
// The service has "/", "/reserve", "/pricing".
// If we want the full path /venues/:venueId/matches/:matchId/seats, we need to handle that.
// The task description showing "GET /venues/{venueId}/matches/{matchId}/seats" suggests it belongs under venues.
// However, to keep services modular, I'll mount it where it makes sense or as a sub-router if Hono supports wildcard mounting well.
// For simplicity and to match the routes list strictly, I can mount it at root or under venues if I had a sub-router in venues.
// BUT, since `VenueService` logic is separate from `SeatsService` logic, I'll mount it at a path that captures the prefix if possible.
// Hono allows `app.route('/venues/:venueId/matches/:matchId/seats', seatsRouter.getRouter)`
app.route("/venues/:venueId/matches/:matchId/seats", seatsRouter.getRouter);
app.route("/profile", profileRouter.getRouter);
app.route("/partners", partnerRouter.getRouter);

export default app;