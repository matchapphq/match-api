import { createFactory } from "hono/factory";
import Stripe from "stripe";
import { STRIPE_WEBHOOK_SECRET } from "../../config/stripe";
import stripe from "../../config/stripe";
import { stripeQueue } from "../../queue/stripe.queue";

/**
 * Webhooks Controller
 *
 * Handles incoming webhooks from external services like Stripe.
 *
 * IMPORTANT: Webhook endpoints must:
 * 1. Verify signatures to ensure authenticity
 * 2. Return 200 quickly to avoid timeouts
 * 3. Handle events idempotently (same event may be sent multiple times)
 */
class WebhooksController {
    private readonly factory = createFactory();

    /**
     * POST /webhooks/stripe
     * Handles Stripe webhook events by adding them to a job queue.
     *
     * The worker handles:
     * - checkout.session.completed: User completed checkout, create subscription
     * - invoice.paid: Subscription renewed successfully
     * - invoice.payment_failed: Payment failed, mark subscription past_due
     * - customer.subscription.updated: Subscription changed (upgrade/downgrade)
     * - customer.subscription.deleted: Subscription canceled
     */
    public readonly handleStripeWebhook = this.factory.createHandlers(async (ctx) => {
        const signature = ctx.req.header("stripe-signature");

        if (!signature) {
            console.error("Stripe webhook: Missing signature");
            return ctx.json({ error: "Missing signature" }, 400);
        }

        if (!STRIPE_WEBHOOK_SECRET) {
            console.error("Stripe webhook: Webhook secret not configured");
            return ctx.json({ error: "Webhook not configured" }, 500);
        }

        let event: Stripe.Event;

        try {
            // Get raw body for signature verification
            const rawBody = await ctx.req.text();
            event = stripe.webhooks.constructEvent(
                rawBody,
                signature,
                STRIPE_WEBHOOK_SECRET,
            );
        } catch (err: any) {
            console.error(
                "Stripe webhook signature verification failed:",
                err.message,
            );
            return ctx.json({ error: "Invalid signature" }, 400);
        }

        console.log(`Stripe webhook received: ${event.type} - Adding to queue`);

        try {
            // Add event to queue for async processing
            await stripeQueue.add(event.type, {
                id: event.id,
                type: event.type,
                data: event.data,
                created: event.created,
            });

            return ctx.json({ received: true });
        } catch (error: any) {
            console.error(`Error adding Stripe event ${event.type} to queue:`, error);
            // Return 200 to acknowledge receipt even if adding to queue failed (logs will show issue)
            // Ideally we might want to return 500 here if queue is down, but that might block Stripe
            // better to log and alert.
            return ctx.json({ received: true, error: error.message });
        }
    });
}

export default WebhooksController;
