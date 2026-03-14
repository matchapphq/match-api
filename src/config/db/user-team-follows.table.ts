import { pgTable, timestamp, uuid, index, foreignKey, unique } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { teamsTable } from './sports.table';

// ============================================
// USER TEAM FOLLOWS TABLE
// Allows users to follow specific teams.
// ============================================

export const userTeamFollowsTable = pgTable(
    'user_team_follows',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),
        team_id: uuid('team_id').notNull(),

        followed_at: timestamp('followed_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_user_team_follows_user_id').on(table.user_id),
        index('idx_user_team_follows_team_id').on(table.team_id),
        unique('unique_user_team_follow').on(table.user_id, table.team_id),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_user_team_follows_user_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.team_id],
            foreignColumns: [teamsTable.id],
            name: 'fk_user_team_follows_team_id',
        }).onDelete('cascade'),
    ],
);

export type UserTeamFollow = typeof userTeamFollowsTable.$inferSelect;
export type NewUserTeamFollow = typeof userTeamFollowsTable.$inferInsert;
