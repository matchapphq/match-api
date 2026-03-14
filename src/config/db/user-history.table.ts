import { pgTable, timestamp, uuid, index, foreignKey } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { venuesTable } from './venues.table';

// ============================================
// USER VENUE HISTORY TABLE
// Tracks bars/venues the user has recently viewed
// Powers the "Recently Viewed" section on Discover screen
// ============================================

export const userVenueHistoryTable = pgTable(
    'user_venue_history',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),
        venue_id: uuid('venue_id').notNull(),

        viewed_at: timestamp('viewed_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_venue_history_user_id').on(table.user_id),
        index('idx_venue_history_viewed_at').on(table.viewed_at),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_venue_history_user_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.venue_id],
            foreignColumns: [venuesTable.id],
            name: 'fk_venue_history_venue_id',
        }).onDelete('cascade'),
    ],
);

export type UserVenueHistory = typeof userVenueHistoryTable.$inferSelect;
export type NewUserVenueHistory = typeof userVenueHistoryTable.$inferInsert;
