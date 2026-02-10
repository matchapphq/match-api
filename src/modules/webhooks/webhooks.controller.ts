import { createFactory } from "hono/factory";
import { WebhooksLogic } from "./webhooks.logic";

/**
 * Webhooks Controller
 *
 * Handles incoming webhooks from external services like Stripe.
 */
class WebhooksController {
    private readonly factory = createFactory();

    constructor(private readonly webhooksLogic: WebhooksLogic) {}

    /**
     * POST /webhooks/stripe
     * Handles Stripe webhook events
     */
    public readonly handleStripeWebhook = this.factory.createHandlers(async (ctx) => {
        const signature = ctx.req.header("stripe-signature");

        if (!signature) {
            console.error("Stripe webhook: Missing signature");
            return ctx.json({ error: "Missing signature" }, 400);
        }

        try {
            // Get raw body for signature verification
            const rawBody = await ctx.req.text();
            
            const result = await this.webhooksLogic.handleStripeWebhook(signature, rawBody);
            
            if (result.error) {
                return ctx.json({ received: true, error: result.error }); // Return 200 to acknowledge
            }
            
            return ctx.json({ received: true });
        } catch (error: any) {
            if (error.message === "WEBHOOK_NOT_CONFIGURED") return ctx.json({ error: "Webhook not configured" }, 500);
            if (error.message === "INVALID_SIGNATURE") return ctx.json({ error: "Invalid signature" }, 400);

            console.error(`Error handling Stripe webhook:`, error);
            return ctx.json({ received: true, error: error.message });
        }
    });
}

export default WebhooksController;