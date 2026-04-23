import { pgTable, uuid, varchar, timestamp, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { matchesTable } from './matches.table';

// ============================================
// 21. NOTIFICATION LOGS TABLE (For Idempotency)
// ============================================

export const notificationLogsTable = pgTable(
    'notification_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),
        match_id: uuid('match_id').notNull(),
        
        // e.g., 'upcoming_match_24h', 'upcoming_match_48h'
        notification_type: varchar('notification_type', { length: 50 }).notNull(),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex('idx_notification_logs_idempotency').on(table.user_id, table.match_id, table.notification_type),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_notification_logs_user_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.match_id],
            foreignColumns: [matchesTable.id],
            name: 'fk_notification_logs_match_id',
        }).onDelete('cascade'),
    ],
);

export type NotificationLog = typeof notificationLogsTable.$inferSelect;
export type NewNotificationLog = typeof notificationLogsTable.$inferInsert;
