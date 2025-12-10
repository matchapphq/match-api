import { createFactory } from "hono/factory";

/**
 * Controller for Messaging operations.
 */
class MessagingController {
    private readonly factory = createFactory();

    readonly createConversation = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Start conversation" }, 201);
    });

    readonly getConversations = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get conversations" });
    });

    readonly getMessages = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get messages" });
    });

    readonly sendMessage = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Send message" }, 201);
    });

    readonly editMessage = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Edit message" });
    });

    readonly deleteMessage = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Delete message" });
    });

    readonly archiveConversation = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Archive conversation" });
    });
}

export default MessagingController;
