import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { NotificationsLogic } from "./notifications.logic";

/**
 * Controller for Notifications operations.
 */
class NotificationsController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly notificationsLogic: NotificationsLogic) {}

    /**
     * GET /notifications
     * Get all notifications for the authenticated user
     */
    readonly getNotifications = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user?.id) return ctx.json({ error: "Unauthorized" }, 401);

        const limit = parseInt(ctx.req.query("limit") || "50");
        const offset = parseInt(ctx.req.query("offset") || "0");
        const unreadOnly = ctx.req.query("unreadOnly") === "true";

        try {
            const result = await this.notificationsLogic.getNotifications(user.id, limit, offset, unreadOnly);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching notifications:", error);
            return ctx.json({ error: "Failed to fetch notifications" }, 500);
        }
    });

    /**
     * GET /notifications/unread-count
     * Get just the unread count (lightweight for polling)
     */
    readonly getUnreadCount = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user?.id) return ctx.json({ error: "Unauthorized" }, 401);

        try {
            const result = await this.notificationsLogic.getUnreadCount(user.id);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching unread count:", error);
            return ctx.json({ error: "Failed to fetch unread count" }, 500);
        }
    });

    /**
     * GET /notifications/new
     * Get notifications created after a timestamp (for polling new notifications)
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

        try {
            const result = await this.notificationsLogic.getNewNotifications(user.id, since);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error fetching new notifications:", error);
            return ctx.json({ error: "Failed to fetch new notifications" }, 500);
        }
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

        try {
            const result = await this.notificationsLogic.markAsRead(user.id, notificationId);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "NOTIFICATION_NOT_FOUND") return ctx.json({ error: "Notification not found" }, 404);
            console.error("Error marking notification as read:", error);
            return ctx.json({ error: "Failed to mark notification as read" }, 500);
        }
    });

    /**
     * PUT /notifications/read-all
     * Mark all notifications as read
     */
    readonly markAllAsRead = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get("user");
        if (!user?.id) return ctx.json({ error: "Unauthorized" }, 401);

        try {
            const result = await this.notificationsLogic.markAllAsRead(user.id);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error marking all notifications as read:", error);
            return ctx.json({ error: "Failed to mark all notifications as read" }, 500);
        }
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

        try {
            const result = await this.notificationsLogic.deleteNotification(user.id, notificationId);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "NOTIFICATION_NOT_FOUND") return ctx.json({ error: "Notification not found" }, 404);
            console.error("Error deleting notification:", error);
            return ctx.json({ error: "Failed to delete notification" }, 500);
        }
    });
}

export default NotificationsController;