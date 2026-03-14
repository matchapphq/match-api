import { pgTable, timestamp, uuid, index, foreignKey, unique } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { leaguesTable } from './sports.table';

// ============================================
// USER LEAGUE FOLLOWS TABLE
// Allows users to follow specific competitions/leagues.
// ============================================

export const userLeagueFollowsTable = pgTable(
    'user_league_follows',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),
        league_id: uuid('league_id').notNull(),

        followed_at: timestamp('followed_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_user_league_follows_user_id').on(table.user_id),
        index('idx_user_league_follows_league_id').on(table.league_id),
        unique('unique_user_league_follow').on(table.user_id, table.league_id),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_user_league_follows_user_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.league_id],
            foreignColumns: [leaguesTable.id],
            name: 'fk_user_league_follows_league_id',
        }).onDelete('cascade'),
    ],
);

export type UserLeagueFollow = typeof userLeagueFollowsTable.$inferSelect;
export type NewUserLeagueFollow = typeof userLeagueFollowsTable.$inferInsert;
