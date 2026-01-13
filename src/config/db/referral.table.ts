import {
    pgTable,
    varchar,
    uuid,
    timestamp,
    boolean,
    integer,
    numeric,
    jsonb,
    index,
    foreignKey,
    unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { usersTable } from './user.table';
import { referralStatusEnum, boostTypeEnum, boostStatusEnum } from './enums';

// ============================================
// REFERRAL CODES TABLE
// Stores unique referral codes for each user
// ============================================

export const referralCodesTable = pgTable('referral_codes', {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    referral_code: varchar('referral_code', { length: 50 }).notNull().unique(),
    referral_link: varchar('referral_link', { length: 255 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_referral_code').on(table.referral_code),
    index('idx_user_referral').on(table.user_id),
    unique('unique_user_referral').on(table.user_id),
    foreignKey({
        columns: [table.user_id],
        foreignColumns: [usersTable.id],
        name: 'fk_referral_codes_user_id',
    }).onDelete('cascade'),
]);

export type ReferralCode = typeof referralCodesTable.$inferSelect;
export type NewReferralCode = typeof referralCodesTable.$inferInsert;

// ============================================
// REFERRALS TABLE
// Tracks referrals (who invited whom)
// ============================================

export const referralsTable = pgTable('referrals', {
    id: uuid('id').primaryKey().defaultRandom(),
    referrer_id: uuid('referrer_id').notNull(),
    referred_user_id: uuid('referred_user_id'),
    referral_code: varchar('referral_code', { length: 50 }).notNull(),
    
    status: referralStatusEnum('status').default('invited').notNull(),
    
    invited_at: timestamp('invited_at', { withTimezone: true }).defaultNow(),
    signed_up_at: timestamp('signed_up_at', { withTimezone: true }),
    converted_at: timestamp('converted_at', { withTimezone: true }),
    
    reward_granted: boolean('reward_granted').default(false),
    reward_type: varchar('reward_type', { length: 50 }),
    reward_value: integer('reward_value'),
    
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_referrer').on(table.referrer_id),
    index('idx_referred_user').on(table.referred_user_id),
    index('idx_referral_status').on(table.status),
    foreignKey({
        columns: [table.referrer_id],
        foreignColumns: [usersTable.id],
        name: 'fk_referrals_referrer_id',
    }).onDelete('cascade'),
    foreignKey({
        columns: [table.referred_user_id],
        foreignColumns: [usersTable.id],
        name: 'fk_referrals_referred_user_id',
    }).onDelete('set null'),
]);

export type Referral = typeof referralsTable.$inferSelect;
export type NewReferral = typeof referralsTable.$inferInsert;

// ============================================
// REFERRAL STATS TABLE
// Cached statistics per user (for performance)
// ============================================

export const referralStatsTable = pgTable('referral_stats', {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    
    total_invited: integer('total_invited').default(0).notNull(),
    total_signed_up: integer('total_signed_up').default(0).notNull(),
    total_converted: integer('total_converted').default(0).notNull(),
    total_rewards_earned: integer('total_rewards_earned').default(0).notNull(),
    
    rewards_value: numeric('rewards_value', { precision: 10, scale: 2 }).default('0'),
    
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_user_stats').on(table.user_id),
    unique('unique_user_stats').on(table.user_id),
    foreignKey({
        columns: [table.user_id],
        foreignColumns: [usersTable.id],
        name: 'fk_referral_stats_user_id',
    }).onDelete('cascade'),
]);

export type ReferralStats = typeof referralStatsTable.$inferSelect;
export type NewReferralStats = typeof referralStatsTable.$inferInsert;

// ============================================
// BOOSTS TABLE
// Stores boosts (purchased, referral rewards, promotional)
// ============================================

export const boostsTable = pgTable('boosts', {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    
    type: boostTypeEnum('type').notNull(),
    status: boostStatusEnum('status').default('available').notNull(),
    source: varchar('source', { length: 100 }),
    
    venue_match_id: uuid('venue_match_id'),
    used_at: timestamp('used_at', { withTimezone: true }),
    expires_at: timestamp('expires_at', { withTimezone: true }),
    
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_boosts_user_id').on(table.user_id),
    index('idx_boosts_status').on(table.status),
    index('idx_boosts_type').on(table.type),
    foreignKey({
        columns: [table.user_id],
        foreignColumns: [usersTable.id],
        name: 'fk_boosts_user_id',
    }).onDelete('cascade'),
]);

export type Boost = typeof boostsTable.$inferSelect;
export type NewBoost = typeof boostsTable.$inferInsert;
