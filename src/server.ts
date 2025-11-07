import { Hono } from "hono";
import AuthService from "./services/auth.service";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import BookingService from "./services/booking.service";
import VenueService from "./services/venues.service";

const app = new Hono();

const authRouter = new AuthService();
const bookingRouter = new BookingService();
const venueRouter = new VenueService();

app.use(logger());
app.use(prettyJSON());

app.route("/auth", authRouter.getRouter);
app.route("/bookings", bookingRouter.getRouter);
app.route("/venues", venueRouter.getRouter);

export default app;