import { createFactory } from "hono/factory";
import { HealthLogic } from "./health.logic";

class HealthController {
    private readonly factory = createFactory();

    constructor(private readonly healthLogic: HealthLogic) {}

    public readonly health = this.factory.createHandlers(async (ctx) => {
        const result = await this.healthLogic.checkHealth();
        return ctx.text(result);
    });

    public readonly test = this.factory.createHandlers(async (ctx) => {
        const type = (ctx.req.query("type") as string | undefined) || "all";
        const email = ctx.req.query("email") || "rafael.sapalo07@gmail.com";

        const result = await this.healthLogic.testEmails(email, type);
        return ctx.json(result);
    });
}

export default HealthController;