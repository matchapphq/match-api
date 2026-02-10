import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { NotificationsRepository } from "../../repository/notifications.repository";

/**
 * Controller for Notifications operations.
 */
class NotificationsController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly repository = new NotificationsRepository();

    /**
     * GET /notifications
     * Get all notifications for the authenticated user
     * Query params: limit, offset, unreadOnly
     */
    readonly getNotifications = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        console.log('[NotificationsController] getNotifications called for user:', user?.id);
        if (!user?.id) return ctx.json({ error: "Unauthorized" }, 401);

        const limit = parseInt(ctx.req.query("limit") || "50");
        const offset = parseInt(ctx.req.query("offset") || "0");
        const unreadOnly = ctx.req.query("unreadOnly") === "true";

        const notifications = await this.repository.findByUserId(user.id, {
            limit,
            offset,
            unreadOnly
        });

        const unreadCount = await this.repository.getUnreadCount(user.id);
        console.log('[NotificationsController] Found', notifications.length, 'notifications, unreadCount:', unreadCount);

        return ctx.json({ 
            notifications,
            unreadCount,
            pagination: { limit, offset }
        });
    });

    /**
     * GET /notifications/unread-count
     * Get just the unread count (lightweight for polling)
     */
    readonly getUnreadCount = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user?.id) return ctx.json({ error: "Unauthorized" }, 401);

        const unreadCount = await this.repository.getUnreadCount(user.id);
        return ctx.json({ unreadCount });
    });

    /**
     * GET /notifications/new
     * Get notifications created after a timestamp (for polling new notifications)
     * Query param: since (ISO timestamp)
     */
    readonly getNewNotifications = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user?.id) return ctx.json({ error: "Unauthorized" }, 401);

        const sinceParam = ctx.req.query("since");
        if (!sinceParam) {
            return ctx.json({ error: "Missing 'since' query parameter" }, 400);
        }

        const since = new Date(sinceParam);
        if (isNaN(since.getTime())) {
            return ctx.json({ error: "Invalid 'since' timestamp" }, 400);
        }

        const notifications = await this.repository.getNewNotifications(user.id, since);
        const unreadCount = await this.repository.getUnreadCount(user.id);

        return ctx.json({ 
            notifications,
            unreadCount,
            hasNew: notifications.length > 0
        });
    });

    /**
     * PUT /notifications/:notificationId/read
     * Mark a single notification as read
     */
    readonly markAsRead = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user?.id) return ctx.json({ error: "Unauthorized" }, 401);

        const notificationId = ctx.req.param("notificationId");
        if (!notificationId) {
            return ctx.json({ error: "Notification ID required" }, 400);
        }

        const updated = await this.repository.markAsRead(notificationId, user.id);
        if (!updated) {
            return ctx.json({ error: "Notification not found" }, 404);
        }

        return ctx.json({ 
            message: "Notification marked as read",
            notification: updated
        });
    });

    /**
     * PUT /notifications/read-all
     * Mark all notifications as read
     */
    readonly markAllAsRead = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user?.id) return ctx.json({ error: "Unauthorized" }, 401);

        const count = await this.repository.markAllAsRead(user.id);

        return ctx.json({ 
            message: "All notifications marked as read",
            count
        });
    });

    /**
     * DELETE /notifications/:notificationId
     * Delete a notification
     */
    readonly deleteNotification = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user?.id) return ctx.json({ error: "Unauthorized" }, 401);

        const notificationId = ctx.req.param("notificationId");
        if (!notificationId) {
            return ctx.json({ error: "Notification ID required" }, 400);
        }

        const deleted = await this.repository.delete(notificationId, user.id);
        if (!deleted) {
            return ctx.json({ error: "Notification not found" }, 404);
        }

        return ctx.json({ message: "Notification deleted" });
    });
}

export default NotificationsController;
