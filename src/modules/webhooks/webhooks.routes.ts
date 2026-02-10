import { Hono } from "hono";
import WebhooksController from "./webhooks.controller";
import { WebhooksLogic } from "./webhooks.logic";

/**
 * Service for defining Webhooks routes.
 */
class WebhooksService {
    private readonly router = new Hono();
    private readonly controller: WebhooksController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const webhooksLogic = new WebhooksLogic();
        this.controller = new WebhooksController(webhooksLogic);
        this.initRoutes();
    }

    private initRoutes() {
        this.router.post("/stripe", ...this.controller.handleStripeWebhook);
    }
}

export default WebhooksService;