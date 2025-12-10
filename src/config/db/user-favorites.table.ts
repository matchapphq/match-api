import { pgTable, text, timestamp, uuid, index, foreignKey, unique } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { venuesTable } from './venues.table';

// ============================================
// 3. USER FAVORITE VENUES TABLE
// ============================================

export const userFavoriteVenuesTable = pgTable(
    'user_favorite_venues',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),
        venue_id: uuid('venue_id').notNull(),

        note: text('note'),
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_favorite_venues_user_id').on(table.user_id),
        index('idx_favorite_venues_venue_id').on(table.venue_id),
        unique('unique_user_venue_favorite').on(table.user_id, table.venue_id),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_favorite_venues_user_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.venue_id],
            foreignColumns: [venuesTable.id],
            name: 'fk_favorite_venues_venue_id',
        }).onDelete('cascade'),
    ]
);

export type UserFavoriteVenue = typeof userFavoriteVenuesTable.$inferSelect;
export type NewUserFavoriteVenue = typeof userFavoriteVenuesTable.$inferInsert;
