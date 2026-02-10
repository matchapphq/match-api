import { NotificationsRepository } from "../../repository/notifications.repository";

export class NotificationsLogic {
    constructor(private readonly repository: NotificationsRepository) {}

    async getNotifications(userId: string, limit: number = 50, offset: number = 0, unreadOnly: boolean = false) {
        const notifications = await this.repository.findByUserId(userId, {
            limit,
            offset,
            unreadOnly
        });

        const unreadCount = await this.repository.getUnreadCount(userId);

        return { 
            notifications,
            unreadCount,
            pagination: { limit, offset }
        };
    }

    async getUnreadCount(userId: string) {
        const unreadCount = await this.repository.getUnreadCount(userId);
        return { unreadCount };
    }

    async getNewNotifications(userId: string, since: Date) {
        const notifications = await this.repository.getNewNotifications(userId, since);
        const unreadCount = await this.repository.getUnreadCount(userId);

        return { 
            notifications,
            unreadCount,
            hasNew: notifications.length > 0
        };
    }

    async markAsRead(userId: string, notificationId: string) {
        const updated = await this.repository.markAsRead(notificationId, userId);
        if (!updated) {
            throw new Error("NOTIFICATION_NOT_FOUND");
        }

        return { 
            message: "Notification marked as read",
            notification: updated
        };
    }

    async markAllAsRead(userId: string) {
        const count = await this.repository.markAllAsRead(userId);

        return { 
            message: "All notifications marked as read",
            count
        };
    }

    async deleteNotification(userId: string, notificationId: string) {
        const deleted = await this.repository.delete(notificationId, userId);
        if (!deleted) {
            throw new Error("NOTIFICATION_NOT_FOUND");
        }

        return { message: "Notification deleted" };
    }
}
