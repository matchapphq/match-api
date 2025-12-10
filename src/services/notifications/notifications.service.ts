import { Hono } from "hono";
import NotificationsController from "../../controllers/notifications/notifications.controller";

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

    initRoutes() {
        this.router.get("/", ...this.controller.getNotifications);
        this.router.put("/read-all", ...this.controller.markAllAsRead);
        this.router.put("/:notificationId/read", ...this.controller.markAsRead);
        this.router.delete("/:notificationId", ...this.controller.deleteNotification);
    }
}

export default NotificationsService;
