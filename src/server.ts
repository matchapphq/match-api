import { Hono } from "hono";
import AuthService from "./services/auth.service";
import { logger } from "hono/logger";

const app = new Hono();

const authRouter = new AuthService();

app.use(logger());

app.route("/auth", authRouter.getRouter);
app.get("/getme", async (ctx) => {
    return ctx.json({msg: "here i am"});
})

export default app;