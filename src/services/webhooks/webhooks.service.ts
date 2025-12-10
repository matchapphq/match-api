import { Hono } from "hono";
import WebhooksController from "../../controllers/webhooks/webhooks.controller";

/**
 * Service for defining Webhooks routes.
 */
class WebhooksService {
    private readonly router = new Hono();
    private readonly controller = new WebhooksController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.post("/stripe", ...this.controller.handleStripeWebhook);
    }
}

export default WebhooksService;
