import { pgTable, boolean, timestamp, uuid, index, foreignKey, text } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { venuesTable } from './venues.table';
import { messageTypeEnum } from './enums';

// ============================================
// 19. CONVERSATIONS TABLE
// ============================================

export const conversationsTable = pgTable(
    'conversations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),
        venue_id: uuid('venue_id').notNull(),
        
        last_message_at: timestamp('last_message_at', { withTimezone: true }),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deleted_at: timestamp('deleted_at', { withTimezone: true }),
    },
    (table) => [
        index('idx_conversations_user_id').on(table.user_id),
        index('idx_conversations_venue_id').on(table.venue_id),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_conversations_user_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.venue_id],
            foreignColumns: [venuesTable.id],
            name: 'fk_conversations_venue_id',
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
        sender_id: uuid('sender_id').notNull(), // User ID of the sender
        
        type: messageTypeEnum('type').default('text').notNull(),
        content: text('content').notNull(),
        media_url: text('media_url'),
        
        is_read: boolean('is_read').default(false).notNull(),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deleted_at: timestamp('deleted_at', { withTimezone: true }),
    },
    (table) => [
        index('idx_messaging_conversation_id').on(table.conversation_id),
        index('idx_messaging_sender_id').on(table.sender_id),
        foreignKey({
            columns: [table.conversation_id],
            foreignColumns: [conversationsTable.id],
            name: 'fk_messaging_conversation_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.sender_id],
            foreignColumns: [usersTable.id],
            name: 'fk_messaging_sender_id',
        }).onDelete('cascade'),
    ]
);

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;
