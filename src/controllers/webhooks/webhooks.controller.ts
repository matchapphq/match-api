import { createFactory } from "hono/factory";

/**
 * Controller for Webhooks operations.
 */
class WebhooksController {
    private readonly factory = createFactory();

    readonly handleStripeWebhook = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ received: true });
    });
}

export default WebhooksController;
