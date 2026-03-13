import { pgTable, varchar, boolean, timestamp, uuid, index, foreignKey, text } from 'drizzle-orm/pg-core';
import { sportsTable } from './sports.table';

// ============================================
// TOURNAMENTS TABLE
// Major temporary competitions (e.g. World Cup, NBA Finals)
// ============================================

export const tournamentsTable = pgTable(
    'tournaments',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        sport_id: uuid('sport_id').notNull(),

        name: varchar('name', { length: 255 }).notNull(),
        slug: varchar('slug', { length: 255 }).notNull().unique(),
        description: text('description'),
        
        starts_at: timestamp('starts_at', { withTimezone: true }).notNull(),
        ends_at: timestamp('ends_at', { withTimezone: true }).notNull(),
        
        is_active: boolean('is_active').default(true).notNull(),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_tournaments_sport_id').on(table.sport_id),
        index('idx_tournaments_active_dates').on(table.starts_at, table.ends_at),
        foreignKey({
            columns: [table.sport_id],
            foreignColumns: [sportsTable.id],
            name: 'fk_tournaments_sport_id',
        }).onDelete('cascade'),
    ],
);

export type Tournament = typeof tournamentsTable.$inferSelect;
export type NewTournament = typeof tournamentsTable.$inferInsert;

// ============================================
// HERO BANNERS TABLE
// Featured content at the top of Discover screen
// = :CURATION
// ============================================

export const heroBannersTable = pgTable(
    'hero_banners',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tournament_id: uuid('tournament_id'), // Optional link to a tournament
        sport_id: uuid('sport_id').notNull(),

        title: varchar('title', { length: 255 }).notNull(),
        subtitle: varchar('subtitle', { length: 255 }),
        date_range_label: varchar('date_range_label', { length: 100 }), // e.g. "Du 20 Nov au 18 Dec"
        
        image_url: text('image_url').notNull(),
        cta_link: text('cta_link'), // App link or deep link
        
        display_order: timestamp('display_order', { withTimezone: true }).defaultNow().notNull(),
        is_active: boolean('is_active').default(true).notNull(),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_hero_banners_sport_id').on(table.sport_id),
        index('idx_hero_banners_is_active').on(table.is_active),
        foreignKey({
            columns: [table.tournament_id],
            foreignColumns: [tournamentsTable.id],
            name: 'fk_hero_banners_tournament_id',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.sport_id],
            foreignColumns: [sportsTable.id],
            name: 'fk_hero_banners_sport_id',
        }).onDelete('cascade'),
    ],
);

export type HeroBanner = typeof heroBannersTable.$inferSelect;
export type NewHeroBanner = typeof heroBannersTable.$inferInsert;
