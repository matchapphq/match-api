import { pgTable, varchar, numeric, boolean, timestamp, uuid, index, foreignKey, integer, text, jsonb, date } from 'drizzle-orm/pg-core';
import { users } from './user.table';
import { couponTypeEnum, auditActionEnum } from './enums';

// ============================================
// TYPES
// ============================================

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export type AuditLogValues = Record<string, unknown>;

// ============================================
// 24. ANALYTICS TABLE
// ============================================

export const analytics = pgTable(
    'analytics',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        venue_id: uuid('venue_id'),
        user_id: uuid('user_id'),

        event_type: varchar('event_type', { length: 100 }).notNull(),
        event_name: varchar('event_name', { length: 255 }).notNull(),

        properties: jsonb('properties').$type<AnalyticsProperties>(),

        session_id: varchar('session_id', { length: 255 }),
        user_agent: text('user_agent'),
        ip_address: varchar('ip_address', { length: 45 }),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_analytics_venue_id').on(table.venue_id),
        index('idx_analytics_user_id').on(table.user_id),
        index('idx_analytics_event_type').on(table.event_type),
        index('idx_analytics_created_at').on(table.created_at),
    ]
);

export type Analytics = typeof analytics.$inferSelect;
export type NewAnalytics = typeof analytics.$inferInsert;

// ============================================
// 25. COUPONS TABLE
// ============================================

export const coupons = pgTable(
    'coupons',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        code: varchar('code', { length: 50 }).notNull().unique(),

        type: couponTypeEnum('type').notNull(),
        value: numeric('value', { precision: 10, scale: 2 }).notNull(),

        // Usage limits
        max_uses: integer('max_uses'),
        uses_count: integer('uses_count').default(0),

        // Validity
        valid_from: date('valid_from').notNull(),
        valid_until: date('valid_until').notNull(),

        // Conditions
        min_purchase_amount: numeric('min_purchase_amount', { precision: 10, scale: 2 }),
        applicable_to_venues: text('applicable_to_venues').array(),

        is_active: boolean('is_active').default(true),
        description: text('description'),

        created_by: uuid('created_by'),
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_coupons_code').on(table.code),
        index('idx_coupons_is_active').on(table.is_active),
        index('idx_coupons_valid_from').on(table.valid_from),
        index('idx_coupons_valid_until').on(table.valid_until),
    ]
);

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;

// ============================================
// 26. AUDIT LOGS TABLE
// ============================================

export const auditLogs = pgTable(
    'audit_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id'),

        action: auditActionEnum('action').notNull(),
        entity_type: varchar('entity_type', { length: 100 }).notNull(),
        entity_id: uuid('entity_id').notNull(),

        // Changes
        old_values: jsonb('old_values').$type<AuditLogValues>(),
        new_values: jsonb('new_values').$type<AuditLogValues>(),

        // Context
        ip_address: varchar('ip_address', { length: 45 }),
        user_agent: text('user_agent'),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_audit_logs_user_id').on(table.user_id),
        index('idx_audit_logs_action').on(table.action),
        index('idx_audit_logs_entity_type').on(table.entity_type),
        index('idx_audit_logs_created_at').on(table.created_at),
    ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// ============================================
// 27. BANNED USERS TABLE
// ============================================

export const bannedUsers = pgTable(
    'banned_users',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull().unique(),

        reason: varchar('reason', { length: 255 }).notNull(),
        details: text('details'),

        banned_by: uuid('banned_by'),

        banned_at: timestamp('banned_at', { withTimezone: true }).defaultNow().notNull(),
        unbanned_at: timestamp('unbanned_at', { withTimezone: true }),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_banned_users_user_id').on(table.user_id),
        index('idx_banned_users_banned_at').on(table.banned_at),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [users.id],
            name: 'fk_banned_users_user_id',
        }).onDelete('cascade'),
    ]
);

export type BannedUser = typeof bannedUsers.$inferSelect;
export type NewBannedUser = typeof bannedUsers.$inferInsert;
