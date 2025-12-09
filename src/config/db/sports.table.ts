import { pgTable, varchar, boolean, timestamp, uuid, index, foreignKey, integer, text } from 'drizzle-orm/pg-core';

// ============================================
// 8. SPORTS TABLE
// ============================================

export const sports = pgTable(
    'sports',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        name: varchar('name', { length: 100 }).notNull().unique(),
        slug: varchar('slug', { length: 100 }).notNull().unique(),
        description: text('description'),
        icon_url: text('icon_url'),

        is_active: boolean('is_active').default(true),
        display_order: integer('display_order').default(0),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_sports_slug').on(table.slug),
        index('idx_sports_is_active').on(table.is_active),
    ]
);

export type Sport = typeof sports.$inferSelect;
export type NewSport = typeof sports.$inferInsert;

// ============================================
// 9. LEAGUES TABLE
// ============================================

export const leagues = pgTable(
    'leagues',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        sport_id: uuid('sport_id').notNull(),

        name: varchar('name', { length: 150 }).notNull(),
        slug: varchar('slug', { length: 150 }).notNull().unique(),
        country: varchar('country', { length: 100 }),
        description: text('description'),
        logo_url: text('logo_url'),

        is_active: boolean('is_active').default(true),
        display_order: integer('display_order').default(0),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_leagues_sport_id').on(table.sport_id),
        index('idx_leagues_slug').on(table.slug),
        index('idx_leagues_is_active').on(table.is_active),
        foreignKey({
            columns: [table.sport_id],
            foreignColumns: [sports.id],
            name: 'fk_leagues_sport_id',
        }).onDelete('cascade'),
    ]
);

export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;

// ============================================
// 10. TEAMS TABLE
// ============================================

export const teams = pgTable(
    'teams',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        league_id: uuid('league_id').notNull(),

        name: varchar('name', { length: 150 }).notNull(),
        slug: varchar('slug', { length: 150 }).notNull().unique(),
        country: varchar('country', { length: 100 }),
        city: varchar('city', { length: 100 }),
        description: text('description'),
        logo_url: text('logo_url'),
        founded_year: integer('founded_year'),

        is_active: boolean('is_active').default(true),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_teams_league_id').on(table.league_id),
        index('idx_teams_slug').on(table.slug),
        index('idx_teams_is_active').on(table.is_active),
        foreignKey({
            columns: [table.league_id],
            foreignColumns: [leagues.id],
            name: 'fk_teams_league_id',
        }).onDelete('cascade'),
    ]
);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
