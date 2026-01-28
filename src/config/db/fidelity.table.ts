import { pgTable, varchar, boolean, timestamp, uuid, index, text, jsonb, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { pgEnum } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';

// ============================================
// ENUMS
// ============================================

export const challengeStatusEnum = pgEnum('challenge_status', [
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED',
    'EXPIRED'
]);

export const challengeRecurrenceEnum = pgEnum('challenge_recurrence', [
    'NONE',
    'DAILY',
    'WEEKLY',
    'MONTHLY'
]);

export const badgeCategoryEnum = pgEnum('badge_category', [
    'DISCOVERY',
    'ACTIVITY',
    'REVIEWS',
    'SOCIAL',
    'SPECIAL'
]);

// ============================================
// 1. FIDELITY LEVELS TABLE
// ============================================
// Defines the level thresholds and perks

export const fidelityLevelsTable = pgTable(
    'fidelity_levels',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        
        name: varchar('name', { length: 100 }).notNull(), // e.g. "Rookie", "Supporter Silver"
        description: text('description'),
        
        min_points: integer('min_points').notNull().default(0),
        max_points: integer('max_points'), // null means no upper limit (top level)
        
        rank: integer('rank').notNull().default(0), // Order for display
        
        icon_key: varchar('icon_key', { length: 100 }), // Icon identifier
        color: varchar('color', { length: 20 }), // Theme color for level
        
        perks: jsonb('perks').$type<{
            special_offers?: boolean;
            priority_booking?: boolean;
            exclusive_badges?: boolean;
            discount_percentage?: number;
        }>(),
        
        is_active: boolean('is_active').default(true).notNull(),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_fidelity_levels_min_points').on(table.min_points),
        index('idx_fidelity_levels_rank').on(table.rank),
    ]
);

export type FidelityLevel = typeof fidelityLevelsTable.$inferSelect;
export type NewFidelityLevel = typeof fidelityLevelsTable.$inferInsert;

// ============================================
// 2. FIDELITY POINT RULES TABLE
// ============================================
// Defines how many points each action awards

export const fidelityPointRulesTable = pgTable(
    'fidelity_point_rules',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        
        action_key: varchar('action_key', { length: 100 }).notNull().unique(), // e.g. "BOOK_RESERVATION", "CHECK_IN"
        display_name: varchar('display_name', { length: 200 }).notNull(),
        description: text('description'),
        
        base_points: integer('base_points').notNull().default(0),
        
        // Optional caps and conditions
        max_per_day: integer('max_per_day'), // Max points from this action per day
        max_per_week: integer('max_per_week'),
        max_per_month: integer('max_per_month'),
        
        // Conditions stored as JSON for flexibility
        conditions: jsonb('conditions').$type<{
            only_first_per_venue?: boolean;
            only_first_per_match?: boolean;
            min_review_length?: number;
            requires_photo?: boolean;
        }>(),
        
        is_active: boolean('is_active').default(true).notNull(),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_fidelity_point_rules_action_key').on(table.action_key),
    ]
);

export type FidelityPointRule = typeof fidelityPointRulesTable.$inferSelect;
export type NewFidelityPointRule = typeof fidelityPointRulesTable.$inferInsert;

// ============================================
// 3. FIDELITY POINT TRANSACTIONS TABLE
// ============================================
// Ledger of all points earned by users

export const fidelityPointTransactionsTable = pgTable(
    'fidelity_point_transactions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        
        user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
        
        action_key: varchar('action_key', { length: 100 }).notNull(),
        reference_id: varchar('reference_id', { length: 100 }), // ID of the related entity (reservation, review, etc.)
        reference_type: varchar('reference_type', { length: 50 }), // Type: "reservation", "review", "check_in", etc.
        
        points: integer('points').notNull(),
        
        description: text('description'), // Human-readable description
        
        metadata: jsonb('metadata').$type<{
            venue_id?: string;
            match_id?: string;
            bonus_multiplier?: number;
            [key: string]: any;
        }>(),
        
        // For idempotency
        idempotency_key: varchar('idempotency_key', { length: 255 }),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_fidelity_transactions_user_id').on(table.user_id),
        index('idx_fidelity_transactions_action_key').on(table.action_key),
        index('idx_fidelity_transactions_created_at').on(table.created_at),
        // Idempotency: prevent duplicate awards for same action on same reference
        uniqueIndex('idx_fidelity_transactions_idempotency').on(table.user_id, table.action_key, table.reference_id),
    ]
);

export type FidelityPointTransaction = typeof fidelityPointTransactionsTable.$inferSelect;
export type NewFidelityPointTransaction = typeof fidelityPointTransactionsTable.$inferInsert;

// ============================================
// 4. FIDELITY USER STATS TABLE
// ============================================
// Cached stats for quick queries

export const fidelityUserStatsTable = pgTable(
    'fidelity_user_stats',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        
        user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }).unique(),
        
        total_points: integer('total_points').notNull().default(0),
        current_level_id: uuid('current_level_id').references(() => fidelityLevelsTable.id),
        
        // Counts for badge/challenge calculations
        total_reservations: integer('total_reservations').default(0),
        total_check_ins: integer('total_check_ins').default(0),
        total_reviews: integer('total_reviews').default(0),
        total_venues_visited: integer('total_venues_visited').default(0),
        total_invites_completed: integer('total_invites_completed').default(0),
        
        // Streak tracking
        current_streak_days: integer('current_streak_days').default(0),
        longest_streak_days: integer('longest_streak_days').default(0),
        last_activity_date: timestamp('last_activity_date', { withTimezone: true }),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_fidelity_user_stats_user_id').on(table.user_id),
        index('idx_fidelity_user_stats_total_points').on(table.total_points),
    ]
);

export type FidelityUserStats = typeof fidelityUserStatsTable.$inferSelect;
export type NewFidelityUserStats = typeof fidelityUserStatsTable.$inferInsert;

// ============================================
// 5. FIDELITY BADGES TABLE
// ============================================
// Badge definitions

export const fidelityBadgesTable = pgTable(
    'fidelity_badges',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        
        name: varchar('name', { length: 100 }).notNull(),
        description: text('description'),
        category: badgeCategoryEnum('category').notNull().default('ACTIVITY'),
        
        icon_key: varchar('icon_key', { length: 100 }),
        color: varchar('color', { length: 20 }),
        
        // Unlock conditions (flexible JSON structure)
        unlock_conditions: jsonb('unlock_conditions').$type<{
            type: 'COUNT' | 'DISTINCT_COUNT' | 'STREAK' | 'POINTS' | 'LEVEL' | 'CUSTOM';
            action_key?: string; // e.g. "CHECK_IN", "CREATE_REVIEW"
            target_count?: number;
            time_window_days?: number; // For time-bound conditions
            distinct_field?: string; // e.g. "venue_id" for distinct venues
            min_points?: number;
            min_level_rank?: number;
            custom_rule?: string;
        }>().notNull(),
        
        // Reward for unlocking
        reward_points: integer('reward_points').default(0),
        
        // Display order and visibility
        rank: integer('rank').default(0),
        is_secret: boolean('is_secret').default(false), // Hidden until unlocked
        is_active: boolean('is_active').default(true).notNull(),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_fidelity_badges_category').on(table.category),
        index('idx_fidelity_badges_rank').on(table.rank),
    ]
);

export type FidelityBadge = typeof fidelityBadgesTable.$inferSelect;
export type NewFidelityBadge = typeof fidelityBadgesTable.$inferInsert;

// ============================================
// 6. FIDELITY USER BADGES TABLE
// ============================================
// Tracks which badges users have unlocked

export const fidelityUserBadgesTable = pgTable(
    'fidelity_user_badges',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        
        user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
        badge_id: uuid('badge_id').notNull().references(() => fidelityBadgesTable.id, { onDelete: 'cascade' }),
        
        unlocked_at: timestamp('unlocked_at', { withTimezone: true }).defaultNow().notNull(),
        
        // What triggered the unlock
        source_event_type: varchar('source_event_type', { length: 100 }),
        source_event_id: varchar('source_event_id', { length: 100 }),
        
        // Points awarded when unlocked
        points_awarded: integer('points_awarded').default(0),
    },
    (table) => [
        index('idx_fidelity_user_badges_user_id').on(table.user_id),
        index('idx_fidelity_user_badges_badge_id').on(table.badge_id),
        uniqueIndex('idx_fidelity_user_badges_unique').on(table.user_id, table.badge_id),
    ]
);

export type FidelityUserBadge = typeof fidelityUserBadgesTable.$inferSelect;
export type NewFidelityUserBadge = typeof fidelityUserBadgesTable.$inferInsert;

// ============================================
// 7. FIDELITY CHALLENGES TABLE
// ============================================
// Challenge/quest definitions

export const fidelityChallengesTable = pgTable(
    'fidelity_challenges',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        
        name: varchar('name', { length: 200 }).notNull(),
        description: text('description'),
        
        // What action counts toward this challenge
        action_key: varchar('action_key', { length: 100 }).notNull(),
        
        // Completion criteria
        target_count: integer('target_count').notNull().default(1),
        
        // Additional conditions
        conditions: jsonb('conditions').$type<{
            distinct_venues?: boolean;
            specific_venue_id?: string;
            specific_sport?: string;
            min_party_size?: number;
        }>(),
        
        // Time model
        recurrence: challengeRecurrenceEnum('recurrence').default('NONE'),
        start_at: timestamp('start_at', { withTimezone: true }),
        end_at: timestamp('end_at', { withTimezone: true }),
        duration_days: integer('duration_days'), // For recurring challenges
        
        // Rewards
        reward_points: integer('reward_points').notNull().default(0),
        reward_badge_id: uuid('reward_badge_id').references(() => fidelityBadgesTable.id),
        
        // Display
        icon_key: varchar('icon_key', { length: 100 }),
        color: varchar('color', { length: 20 }),
        rank: integer('rank').default(0),
        
        is_active: boolean('is_active').default(true).notNull(),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_fidelity_challenges_action_key').on(table.action_key),
        index('idx_fidelity_challenges_start_at').on(table.start_at),
        index('idx_fidelity_challenges_end_at').on(table.end_at),
    ]
);

export type FidelityChallenge = typeof fidelityChallengesTable.$inferSelect;
export type NewFidelityChallenge = typeof fidelityChallengesTable.$inferInsert;

// ============================================
// 8. FIDELITY USER CHALLENGES TABLE
// ============================================
// Tracks user progress on challenges

export const fidelityUserChallengesTable = pgTable(
    'fidelity_user_challenges',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        
        user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
        challenge_id: uuid('challenge_id').notNull().references(() => fidelityChallengesTable.id, { onDelete: 'cascade' }),
        
        status: challengeStatusEnum('status').default('NOT_STARTED').notNull(),
        
        progress_count: integer('progress_count').default(0).notNull(),
        
        // Tracking distinct items if needed
        progress_items: jsonb('progress_items').$type<string[]>(), // e.g. venue IDs visited
        
        started_at: timestamp('started_at', { withTimezone: true }),
        completed_at: timestamp('completed_at', { withTimezone: true }),
        expires_at: timestamp('expires_at', { withTimezone: true }),
        
        // Rewards granted
        points_awarded: integer('points_awarded').default(0),
        badge_awarded: boolean('badge_awarded').default(false),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_fidelity_user_challenges_user_id').on(table.user_id),
        index('idx_fidelity_user_challenges_challenge_id').on(table.challenge_id),
        index('idx_fidelity_user_challenges_status').on(table.status),
        index('idx_fidelity_user_challenges_expires_at').on(table.expires_at),
        // Unique per user per challenge instance (for non-recurring) or per period (for recurring)
        uniqueIndex('idx_fidelity_user_challenges_unique').on(table.user_id, table.challenge_id, table.started_at),
    ]
);

export type FidelityUserChallenge = typeof fidelityUserChallengesTable.$inferSelect;
export type NewFidelityUserChallenge = typeof fidelityUserChallengesTable.$inferInsert;

// ============================================
// 9. FIDELITY EVENTS LOG TABLE
// ============================================
// Audit log for fidelity system events

export const fidelityEventsLogTable = pgTable(
    'fidelity_events_log',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        
        user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
        
        event_type: varchar('event_type', { length: 100 }).notNull(), // POINTS_EARNED, LEVEL_UP, BADGE_UNLOCKED, CHALLENGE_COMPLETED
        
        details: jsonb('details').$type<{
            points_earned?: number;
            new_level?: string;
            badge_name?: string;
            challenge_name?: string;
            old_total_points?: number;
            new_total_points?: number;
            [key: string]: any;
        }>(),
        
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_fidelity_events_log_user_id').on(table.user_id),
        index('idx_fidelity_events_log_event_type').on(table.event_type),
        index('idx_fidelity_events_log_created_at').on(table.created_at),
    ]
);

export type FidelityEventLog = typeof fidelityEventsLogTable.$inferSelect;
export type NewFidelityEventLog = typeof fidelityEventsLogTable.$inferInsert;
