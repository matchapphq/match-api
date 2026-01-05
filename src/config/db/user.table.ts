import { pgTable, varchar, boolean, timestamp, uuid, index, text, jsonb, doublePrecision } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';

// ============================================
// 1. USERS TABLE
// ============================================

export const usersTable = pgTable(
    'users',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        // Auth
        email: varchar('email', { length: 255 }).notNull().unique(),
        password_hash: varchar('password_hash', { length: 255 }).notNull(),

        // Profile
        first_name: varchar('first_name', { length: 100 }),
        last_name: varchar('last_name', { length: 100 }),
        phone: varchar('phone', { length: 20 }),
        avatar_url: text('avatar_url'),

        // Role & Permissions
        role: userRoleEnum('role').default('user').notNull(),
        is_verified: boolean('is_verified').default(false),
        is_active: boolean('is_active').default(true),

        // Stripe
        stripe_customer_id: varchar('stripe_customer_id', { length: 255 }),

        // Metadata
        last_login_at: timestamp('last_login_at', { withTimezone: true }),
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deleted_at: timestamp('deleted_at', { withTimezone: true }),
    },
    (table) => [
        index('idx_users_email').on(table.email),
        index('idx_users_role').on(table.role),
        index('idx_users_stripe_customer_id').on(table.stripe_customer_id),
    ]
);

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

// ============================================
// 2. USER PREFERENCES TABLE
// ============================================

export const userPreferencesTable = pgTable(
    'user_preferences',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),

        // Settings
        language: varchar('language', { length: 10 }).default('en'),
        timezone: varchar('timezone', { length: 50 }).default('UTC'),
        theme: varchar('theme', { length: 20 }).default('system'),

        // Location
        home_lat: doublePrecision('home_lat'),
        home_lng: doublePrecision('home_lng'),

        // Interests
        fav_sports: jsonb('fav_sports').$type<string[] | null>(),
        fav_team_ids: jsonb('fav_team_ids').$type<string[] | null>(),
        
        ambiances: jsonb('ambiances').$type<string[] | null>(),
        budget: varchar('budget', { length: 50 }),
        venue_types: jsonb('venue_types').$type<string[] | null>(),


        // Notifications
        notification_settings: jsonb('notification_settings').default({
            email: true,
            push: true,
            sms: false,
            marketing: false
        }),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_user_preferences_user_id').on(table.user_id),
    ]
);

export type UserPreferences = typeof userPreferencesTable.$inferSelect;
export type NewUserPreferences = typeof userPreferencesTable.$inferInsert;
