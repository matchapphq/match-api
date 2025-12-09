import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    timestamp,
    index,
    jsonb,
    integer,
    foreignKey
} from 'drizzle-orm/pg-core';
import { sql as drizzleSql } from 'drizzle-orm';
import { userRoleEnum, userStatusEnum } from './enums';

// ============================================
// TYPES
// ============================================

export interface NotificationPreferences {
    email_notifications: boolean;
    push_notifications: boolean;
    sms_notifications: boolean;
    quiet_hours_enabled: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
    match_notifications: boolean;
    nearby_venue_notifications: boolean;
    promotion_notifications: boolean;
    reservation_reminders: boolean;
    language_preference: string;
}

// ============================================
// 1. USERS TABLE
// ============================================

export const users = pgTable(
    'users',
    {
        // Primary Key
        id: uuid('id').primaryKey().defaultRandom(),

        // Authentication
        email: varchar('email', { length: 255 }).notNull().unique(),
        email_verified: boolean('email_verified').default(false),
        email_verified_at: timestamp('email_verified_at', { withTimezone: true }),

        password_hash: varchar('password_hash', { length: 255 }).notNull(),
        password_reset_token: varchar('password_reset_token', { length: 255 }).unique(),
        password_reset_expires: timestamp('password_reset_expires', { withTimezone: true }),

        // Profile
        first_name: varchar('first_name', { length: 100 }),
        last_name: varchar('last_name', { length: 100 }),
        phone: varchar('phone', { length: 20 }),
        avatar_url: text('avatar_url'),
        bio: text('bio'),

        // Role & Status
        role: userRoleEnum('role').default('user').notNull(),
        status: userStatusEnum('status').default('active').notNull(),

        // Onboarding
        onboarding_complete: boolean('onboarding_complete').default(false),
        onboarding_completed_at: timestamp('onboarding_completed_at', { withTimezone: true }),

        // Settings
        notification_preferences: jsonb('notification_preferences')
            .default(drizzleSql`json_build_object(
        'email_notifications', true,
        'push_notifications', true,
        'sms_notifications', false,
        'quiet_hours_enabled', false,
        'quiet_hours_start', '22:00',
        'quiet_hours_end', '08:00',
        'match_notifications', true,
        'nearby_venue_notifications', true,
        'promotion_notifications', false,
        'reservation_reminders', true,
        'language_preference', 'en'
      )`)
            .$type<NotificationPreferences>(),

        language: varchar('language', { length: 10 }).default('en'),
        timezone: varchar('timezone', { length: 50 }).default('UTC'),

        // Metadata
        last_login_at: timestamp('last_login_at', { withTimezone: true }),
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deleted_at: timestamp('deleted_at', { withTimezone: true }),
    },
    (table) => [
        index('idx_users_email').on(table.email),
        index('idx_users_role').on(table.role),
        index('idx_users_status').on(table.status),
        index('idx_users_created_at').on(table.created_at),
    ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ============================================
// 2. USER PREFERENCES TABLE
// ============================================

export const userPreferences = pgTable(
    'user_preferences',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull().unique(),

        // Onboarding preferences
        sports: text('sports').array().notNull().default(drizzleSql`ARRAY[]::text[]`),
        ambiances: text('ambiances').array().notNull().default(drizzleSql`ARRAY[]::text[]`),
        venue_types: text('venue_types').array().notNull().default(drizzleSql`ARRAY[]::text[]`),
        budget: varchar('budget', { length: 20 }),
        food_drinks_preferences: text('food_drinks_preferences').array().default(drizzleSql`ARRAY[]::text[]`),

        // Additional preferences
        max_distance_km: integer('max_distance_km').default(10),
        preferred_match_time: varchar('preferred_match_time', { length: 50 }),

        // Metadata
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_user_preferences_user_id').on(table.user_id),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [users.id],
            name: 'fk_user_preferences_user_id',
        }).onDelete('cascade'),
    ]
);

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;