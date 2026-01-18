import { pgTable, varchar, boolean, timestamp, uuid, index, foreignKey, text, unique } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { notificationTypeEnum, messageTypeEnum } from './enums';

// ============================================
// 18. NOTIFICATIONS TABLE
// ============================================

export const notificationsTable = pgTable(
    'notifications',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),

        type: notificationTypeEnum('type').notNull(),
        title: varchar('title', { length: 255 }).notNull(),
        message: text('message').notNull(),

        // Related entity
        related_entity_type: varchar('related_entity_type', { length: 50 }),
        related_entity_id: uuid('related_entity_id'),

        // Status
        is_read: boolean('is_read').default(false),
        read_at: timestamp('read_at', { withTimezone: true }),

        // Delivery channels
        send_email: boolean('send_email').default(false),
        send_push: boolean('send_push').default(false),
        send_sms: boolean('send_sms').default(false),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_notifications_user_id').on(table.user_id),
        index('idx_notifications_is_read').on(table.is_read),
        index('idx_notifications_type').on(table.type),
        index('idx_notifications_created_at').on(table.created_at),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_notifications_user_id',
        }).onDelete('cascade'),
    ]
);

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;

// ============================================
// 19. CONVERSATIONS TABLE
// ============================================

export const conversationsTable = pgTable(
    'conversations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        participant_1_id: uuid('participant_1_id').notNull(),
        participant_2_id: uuid('participant_2_id').notNull(),

        subject: varchar('subject', { length: 255 }),
        is_archived: boolean('is_archived').default(false),

        last_message_at: timestamp('last_message_at', { withTimezone: true }),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_conversations_participant_1_id').on(table.participant_1_id),
        index('idx_conversations_participant_2_id').on(table.participant_2_id),
        unique('unique_conversation').on(table.participant_1_id, table.participant_2_id),
        foreignKey({
            columns: [table.participant_1_id],
            foreignColumns: [usersTable.id],
            name: 'fk_conversations_participant_1_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.participant_2_id],
            foreignColumns: [usersTable.id],
            name: 'fk_conversations_participant_2_id',
        }).onDelete('cascade'),
    ]
);

export type Conversation = typeof conversationsTable.$inferSelect;
export type NewConversation = typeof conversationsTable.$inferInsert;

// ============================================
// 20. MESSAGES TABLE
// ============================================

export const messagesTable = pgTable(
    'messages',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        conversation_id: uuid('conversation_id').notNull(),
        sender_id: uuid('sender_id').notNull(),

        type: messageTypeEnum('type').default('text').notNull(),
        content: text('content').notNull(),

        // File attachment
        file_url: text('file_url'),
        file_name: varchar('file_name', { length: 255 }),

        // Status
        is_read: boolean('is_read').default(false),
        read_at: timestamp('read_at', { withTimezone: true }),

        edited_at: timestamp('edited_at', { withTimezone: true }),
        deleted_at: timestamp('deleted_at', { withTimezone: true }),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_messages_conversation_id').on(table.conversation_id),
        index('idx_messages_sender_id').on(table.sender_id),
        index('idx_messages_is_read').on(table.is_read),
        index('idx_messages_created_at').on(table.created_at),
        foreignKey({
            columns: [table.conversation_id],
            foreignColumns: [conversationsTable.id],
            name: 'fk_messages_conversation_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.sender_id],
            foreignColumns: [usersTable.id],
            name: 'fk_messages_sender_id',
        }).onDelete('cascade'),
    ]
);

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;