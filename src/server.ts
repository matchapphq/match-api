import { Hono } from "hono";
import AuthService from "./services/auth.service";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

const app = new Hono();

const authRouter = new AuthService();

app.use(logger());
app.use(prettyJSON());

app.route("/auth", authRouter.getRouter);
app.get("/getme", async (ctx) => {
    return ctx.json({msg: "here i am"});
})

export default app;