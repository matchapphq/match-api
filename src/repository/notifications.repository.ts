import { db } from "../config/config.db";
import { notificationsTable, type NewNotification, type Notification } from "../config/db/notifications.table";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export class NotificationsRepository {

    /**
     * Create a new notification
     */
    async create(notification: NewNotification): Promise<Notification | null> {
        const [created] = await db.insert(notificationsTable)
            .values(notification)
            .returning();
        return created || null;
    }

    /**
     * Create multiple notifications at once
     */
    async createMany(notifications: NewNotification[]): Promise<Notification[]> {
        if (notifications.length === 0) return [];
        const created = await db.insert(notificationsTable)
            .values(notifications)
            .returning();
        return created;
    }

    /**
     * Get all notifications for a user with pagination
     */
    async findByUserId(
        userId: string, 
        options?: { 
            limit?: number; 
            offset?: number; 
            unreadOnly?: boolean;
            types?: string[];
        }
    ): Promise<Notification[]> {
        const { limit = 50, offset = 0, unreadOnly = false, types } = options || {};

        let query = db.select()
            .from(notificationsTable)
            .where(
                and(
                    eq(notificationsTable.user_id, userId),
                    unreadOnly ? eq(notificationsTable.is_read, false) : undefined,
                    types && types.length > 0 
                        ? inArray(notificationsTable.type, types as any) 
                        : undefined
                )
            )
            .orderBy(desc(notificationsTable.created_at))
            .limit(limit)
            .offset(offset);

        return await query;
    }

    /**
     * Get unread count for a user
     */
    async getUnreadCount(userId: string): Promise<number> {
        const result = await db.select({ count: sql<number>`count(*)` })
            .from(notificationsTable)
            .where(and(
                eq(notificationsTable.user_id, userId),
                eq(notificationsTable.is_read, false)
            ));
        return Number(result[0]?.count || 0);
    }

    /**
     * Get notifications created after a certain timestamp (for polling)
     */
    async getNewNotifications(userId: string, since: Date): Promise<Notification[]> {
        return await db.select()
            .from(notificationsTable)
            .where(and(
                eq(notificationsTable.user_id, userId),
                sql`${notificationsTable.created_at} > ${since}`
            ))
            .orderBy(desc(notificationsTable.created_at));
    }

    /**
     * Mark a single notification as read
     */
    async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
        const [updated] = await db.update(notificationsTable)
            .set({ 
                is_read: true, 
                read_at: new Date() 
            })
            .where(and(
                eq(notificationsTable.id, notificationId),
                eq(notificationsTable.user_id, userId)
            ))
            .returning();
        return updated || null;
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string): Promise<number> {
        const result = await db.update(notificationsTable)
            .set({ 
                is_read: true, 
                read_at: new Date() 
            })
            .where(and(
                eq(notificationsTable.user_id, userId),
                eq(notificationsTable.is_read, false)
            ));
        return result.rowCount || 0;
    }

    /**
     * Delete a notification
     */
    async delete(notificationId: string, userId: string): Promise<boolean> {
        const result = await db.delete(notificationsTable)
            .where(and(
                eq(notificationsTable.id, notificationId),
                eq(notificationsTable.user_id, userId)
            ));
        return (result.rowCount || 0) > 0;
    }

    /**
     * Delete all read notifications older than X days
     */
    async cleanupOldNotifications(userId: string, daysOld: number = 30): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await db.delete(notificationsTable)
            .where(and(
                eq(notificationsTable.user_id, userId),
                eq(notificationsTable.is_read, true),
                sql`${notificationsTable.created_at} < ${cutoffDate}`
            ));
        return result.rowCount || 0;
    }

    /**
     * Find notification by ID
     */
    async findById(notificationId: string): Promise<Notification | null> {
        const result = await db.select()
            .from(notificationsTable)
            .where(eq(notificationsTable.id, notificationId))
            .limit(1);
        return result[0] || null;
    }
}
