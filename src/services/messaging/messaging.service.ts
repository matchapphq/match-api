import { Hono } from "hono";
import MessagingController from "../../controllers/messaging/messaging.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

/**
 * Service for defining Messaging routes.
 */
class MessagingService {
    private readonly router = new Hono();
    private readonly controller = new MessagingController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        this.router.use("/conversations/*", authMiddleware);
        this.router.use("/messages/*", authMiddleware);
        // Conversations
        this.router.post("/conversations", ...this.controller.createConversation);
        this.router.get("/conversations", ...this.controller.getConversations);
        this.router.get("/conversations/:conversationId/messages", ...this.controller.getMessages);
        this.router.post("/conversations/:conversationId/messages", ...this.controller.sendMessage);
        this.router.put("/conversations/:conversationId/archive", ...this.controller.archiveConversation);

        // Messages
        this.router.put("/messages/:messageId", ...this.controller.editMessage);
        this.router.delete("/messages/:messageId", ...this.controller.deleteMessage);
    }
}

export default MessagingService;
