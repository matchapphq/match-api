import { createFactory } from "hono/factory";

/**
 * Controller for Notifications operations.
 */
class NotificationsController {
    private readonly factory = createFactory();

    readonly getNotifications = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get user notifications" });
    });

    readonly markAsRead = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Mark notification as read" });
    });

    readonly markAllAsRead = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Mark all notifications as read" });
    });

    readonly deleteNotification = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Delete notification" });
    });
}

export default NotificationsController;
