import { pgTable, varchar, timestamp, uuid, index, foreignKey, integer, boolean } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { venueMatchesTable } from './matches.table';

// ============================================
// WAITLIST TABLE
// FIFO queue for users waiting for a table when venue is full.
// When a table becomes available (hold expires or reservation cancels),
// the next person in queue gets notified.
// ============================================

export const waitlistTable = pgTable('waitlist', {
    id: uuid('id').primaryKey().defaultRandom(),

    user_id: uuid('user_id').notNull(),
    venue_match_id: uuid('venue_match_id').notNull(),

    party_size: integer('party_size').notNull(),
    requires_accessibility: boolean('requires_accessibility').default(false),

    // Queue position is determined by created_at (FIFO)
    // Status: 'waiting' | 'notified' | 'expired' | 'converted'
    status: varchar('status', { length: 20 }).default('waiting').notNull(),

    // When user was notified a table is available
    notified_at: timestamp('notified_at', { withTimezone: true }),
    // User has X minutes to claim after notification
    notification_expires_at: timestamp('notification_expires_at', { withTimezone: true }),

    // If converted to reservation
    reservation_id: uuid('reservation_id'),

    // Contact preference
    notification_method: varchar('notification_method', { length: 20 }).default('push'), // push, email, sms

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_waitlist_user_id').on(table.user_id),
    index('idx_waitlist_venue_match_id').on(table.venue_match_id),
    index('idx_waitlist_status').on(table.status),
    index('idx_waitlist_created_at').on(table.created_at),
    foreignKey({
        columns: [table.user_id],
        foreignColumns: [usersTable.id],
        name: 'fk_waitlist_user_id',
    }).onDelete('cascade'),
    foreignKey({
        columns: [table.venue_match_id],
        foreignColumns: [venueMatchesTable.id],
        name: 'fk_waitlist_venue_match_id',
    }).onDelete('cascade'),
]);

export type Waitlist = typeof waitlistTable.$inferSelect;
export type NewWaitlist = typeof waitlistTable.$inferInsert;
