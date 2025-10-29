import { Hono } from "hono";
import AuthService from "./services/auth.service";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import BookingService from "./services/booking.service";

const app = new Hono();

const authRouter = new AuthService();
const bookingRouter = new BookingService();

app.use(logger());
app.use(prettyJSON());

app.route("/auth", authRouter.getRouter);
app.route("/booking", bookingRouter.getRouter);

export default app;