import { pgTable, varchar, timestamp, uuid, index, text, jsonb, integer, boolean } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { venuesTable } from './venues.table';

// ============================================
// 1. BETA BUG REPORTS TABLE
// ============================================

export const betaBugReportsTable = pgTable(
    'beta_bug_reports',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
        
        title: varchar('title', { length: 255 }).notNull(),
        description: text('description').notNull(),
        steps_to_reproduce: text('steps_to_reproduce'),
        
        platform: varchar('platform', { length: 50 }), // 'ios', 'android', 'web'
        app_version: varchar('app_version', { length: 50 }),
        
        screenshots: jsonb('screenshots').$type<string[]>(), // URLs to S3
        
        status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'confirmed', 'rejected', 'fixed'
        admin_comment: text('admin_comment'),
        
        points_awarded: boolean('points_awarded').default(false).notNull(),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_bug_reports_user_id').on(table.user_id),
        index('idx_bug_reports_status').on(table.status),
    ],
);

export type BetaBugReport = typeof betaBugReportsTable.$inferSelect;
export type NewBetaBugReport = typeof betaBugReportsTable.$inferInsert;

// ============================================
// 2. VENUE SUGGESTIONS TABLE
// ============================================

export const venueSuggestionsTable = pgTable(
    'venue_suggestions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
        
        name: varchar('name', { length: 255 }).notNull(),
        address: text('address'),
        city: varchar('city', { length: 100 }),
        
        google_maps_url: text('google_maps_url'),
        instagram_handle: varchar('instagram_handle', { length: 100 }),
        
        comment: text('comment'),
        
        status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'validated', 'rejected', 'already_exists'
        admin_comment: text('admin_comment'),
        
        points_awarded: boolean('points_awarded').default(false).notNull(),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_venue_suggestions_user_id').on(table.user_id),
        index('idx_venue_suggestions_status').on(table.status),
    ],
);

export type VenueSuggestion = typeof venueSuggestionsTable.$inferSelect;
export type NewVenueSuggestion = typeof venueSuggestionsTable.$inferInsert;

// ============================================
// 3. USER SCAN HISTORY (for Beta Challenge)
// ============================================
// Tracks QR scans at venues with GPS verification

export const userScanHistoryTable = pgTable(
    'user_scan_history',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
        venue_id: uuid('venue_id').notNull().references(() => venuesTable.id, { onDelete: 'cascade' }),
        
        scanned_at: timestamp('scanned_at', { withTimezone: true }).defaultNow().notNull(),
        
        // GPS verification metadata
        latitude: varchar('latitude', { length: 50 }),
        longitude: varchar('longitude', { length: 50 }),
        distance_meters: integer('distance_meters'),
        is_verified: boolean('is_active').default(true).notNull(), // verified by GPS distance
        
        points_awarded: integer('points_awarded').default(0).notNull(),
        
        metadata: jsonb('metadata').$type<{
            device_id?: string;
            ip_address?: string;
        }>(),
    },
    (table) => [
        index('idx_scan_history_user_id').on(table.user_id),
        index('idx_scan_history_venue_id').on(table.venue_id),
        index('idx_scan_history_scanned_at').on(table.scanned_at),
    ],
);

export type UserScanHistory = typeof userScanHistoryTable.$inferSelect;
export type NewUserScanHistory = typeof userScanHistoryTable.$inferInsert;
