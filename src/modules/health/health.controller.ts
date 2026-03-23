import { createFactory } from "hono/factory";
import { HealthLogic } from "./health.logic";
import { COMMISSION_RATE_CENTS } from "../../config/billing";

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

    public readonly testStripe = this.factory.createHandlers(async (ctx) => {
        try {
            const result = await this.healthLogic.testStripePaymentMethod();
            return ctx.redirect(result.portal_url);
        } catch (error: any) {
            return ctx.json({ 
                error: error.message,
                hint: "Ensure your STRIPE_SECRET_KEY is valid and allows creating customers/portal sessions.",
            }, 500);
        }
    });

    public readonly testCharge = this.factory.createHandlers(async (ctx) => {
        const customerId = ctx.req.query("customerId");
        const amount = Number(ctx.req.query("amount") || COMMISSION_RATE_CENTS);

        if (!customerId) {
            return ctx.json({ error: "customerId query param is required" }, 400);
        }

        try {
            const result = await this.healthLogic.testChargeCustomer(customerId, amount);
            return ctx.json(result);
        } catch (error: any) {
            return ctx.json({ error: error.message }, 400);
        }
    });
}

export default HealthController;