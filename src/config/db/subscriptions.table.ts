import { pgTable, varchar, numeric, boolean, timestamp, uuid, index, foreignKey, integer } from 'drizzle-orm/pg-core';
import { users } from './user.table';
import { subscriptionPlanEnum, subscriptionStatusEnum } from './enums';

// ============================================
// 4. SUBSCRIPTIONS TABLE
// ============================================

export const subscriptions = pgTable(
    'subscriptions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),

        plan: subscriptionPlanEnum('plan').notNull(),
        status: subscriptionStatusEnum('status').default('trialing').notNull(),

        // Billing
        current_period_start: timestamp('current_period_start', { withTimezone: true }).notNull(),
        current_period_end: timestamp('current_period_end', { withTimezone: true }).notNull(),
        trial_start: timestamp('trial_start', { withTimezone: true }),
        trial_end: timestamp('trial_end', { withTimezone: true }),

        // Features
        max_monthly_reservations: integer('max_monthly_reservations').default(999),
        venue_promotion_slots: integer('venue_promotion_slots').default(0),
        advanced_analytics: boolean('advanced_analytics').default(false),
        priority_support: boolean('priority_support').default(false),

        // Pricing
        price: numeric('price', { precision: 10, scale: 2 }).notNull(),
        currency: varchar('currency', { length: 3 }).default('EUR'),

        // Metadata
        stripe_subscription_id: varchar('stripe_subscription_id', { length: 255 }).unique(),
        auto_renew: boolean('auto_renew').default(true),
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        canceled_at: timestamp('canceled_at', { withTimezone: true }),
    },
    (table) => [
        index('idx_subscriptions_user_id').on(table.user_id),
        index('idx_subscriptions_status').on(table.status),
        index('idx_subscriptions_plan').on(table.plan),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [users.id],
            name: 'fk_subscriptions_user_id',
        }).onDelete('cascade'),
    ]
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
