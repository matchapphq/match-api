import { Hono } from "hono";
import NotificationsController from "../../controllers/notifications/notifications.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

/**
 * Service for defining Notifications routes.
 */
class NotificationsService {
    private readonly router = new Hono();
    private readonly controller = new NotificationsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        this.router.use("/*", authMiddleware);
        
        // Get all notifications
        this.router.get("/", ...this.controller.getNotifications);
        
        // Get unread count only (lightweight for polling)
        this.router.get("/unread-count", ...this.controller.getUnreadCount);
        
        // Get new notifications since timestamp (for polling)
        this.router.get("/new", ...this.controller.getNewNotifications);
        
        // Mark all as read
        this.router.put("/read-all", ...this.controller.markAllAsRead);
        
        // Mark single as read
        this.router.put("/:notificationId/read", ...this.controller.markAsRead);
        
        // Delete notification
        this.router.delete("/:notificationId", ...this.controller.deleteNotification);
    }
}

export default NotificationsService;
