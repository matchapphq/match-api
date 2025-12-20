import { pgTable, varchar, numeric, boolean, timestamp, uuid, index, foreignKey, integer, text, unique } from 'drizzle-orm/pg-core';
import { leaguesTable, teamsTable } from './sports.table';
import { venuesTable } from './venues.table';
import { matchStatusEnum, venuePricingTypeEnum } from './enums';

// ============================================
// 11. MATCHES TABLE
// ============================================

export const matchesTable = pgTable(
    'matches',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        league_id: uuid('league_id').notNull(),
        home_team_id: uuid('home_team_id').notNull(),
        away_team_id: uuid('away_team_id').notNull(),

        status: matchStatusEnum('status').default('scheduled').notNull(),

        // Match Info
        scheduled_at: timestamp('scheduled_at', { withTimezone: true }).notNull(),
        started_at: timestamp('started_at', { withTimezone: true }),
        finished_at: timestamp('finished_at', { withTimezone: true }),

        // Scores
        home_team_score: integer('home_team_score'),
        away_team_score: integer('away_team_score'),

        // Details
        round_number: integer('round_number'),
        venue_name: varchar('venue_name', { length: 255 }),
        description: text('description'),

        // Metadata
        external_id: varchar('external_id', { length: 255 }).unique(),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_matches_league_id').on(table.league_id),
        index('idx_matches_status').on(table.status),
        index('idx_matches_scheduled_at').on(table.scheduled_at),
        index('idx_matches_home_team_id').on(table.home_team_id),
        index('idx_matches_away_team_id').on(table.away_team_id),
        foreignKey({
            columns: [table.league_id],
            foreignColumns: [leaguesTable.id],
            name: 'fk_matches_league_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.home_team_id],
            foreignColumns: [teamsTable.id],
            name: 'fk_matches_home_team_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.away_team_id],
            foreignColumns: [teamsTable.id],
            name: 'fk_matches_away_team_id',
        }).onDelete('cascade'),
    ]
);

export type Match = typeof matchesTable.$inferSelect;
export type NewMatch = typeof matchesTable.$inferInsert;

// ============================================
// 12. VENUE MATCHES TABLE
// Links venues to matches they will broadcast. Users can then
// make FREE table reservations to watch the match at the venue.
// ============================================

export const venueMatchesTable = pgTable(
    'venue_matches',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        venue_id: uuid('venue_id').notNull(),
        match_id: uuid('match_id').notNull(),

        // Capacity Management
        total_capacity: integer('total_capacity').notNull(), // Total people the venue can hold for this match
        available_capacity: integer('available_capacity').notNull(), // Remaining spots (bookable)
        reserved_capacity: integer('reserved_capacity').default(0), // Confirmed reservations
        held_capacity: integer('held_capacity').default(0), // Temporary holds (5 min)
        blocked_capacity: integer('blocked_capacity').default(0), // Blocked by owner (maintenance, VIP, etc.)
        
        // Group size limit (e.g., max 10 people per reservation)
        max_group_size: integer('max_group_size').default(10).notNull(),

        // Features
        allows_reservations: boolean('allows_reservations').default(true),

        is_active: boolean('is_active').default(true),
        is_featured: boolean('is_featured').default(false),
        show_on_map: boolean('show_on_map').default(true),

        // Metadata
        estimated_crowd_level: varchar('estimated_crowd_level', { length: 20 }),
        notes: text('notes'),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_venue_matches_venue_id').on(table.venue_id),
        index('idx_venue_matches_match_id').on(table.match_id),
        index('idx_venue_matches_is_active').on(table.is_active),
        unique('unique_venue_match').on(table.venue_id, table.match_id),
        foreignKey({
            columns: [table.venue_id],
            foreignColumns: [venuesTable.id],
            name: 'fk_venue_matches_venue_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.match_id],
            foreignColumns: [matchesTable.id],
            name: 'fk_venue_matches_match_id',
        }).onDelete('cascade'),
    ]
);

export type VenueMatch = typeof venueMatchesTable.$inferSelect;
export type NewVenueMatch = typeof venueMatchesTable.$inferInsert;
