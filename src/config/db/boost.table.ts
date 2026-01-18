import { pgTable, varchar, numeric, boolean, timestamp, uuid, index, foreignKey, integer, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { usersTable } from './user.table';
import { boostsTable } from './referral.table';
import { venueMatchesTable } from './matches.table';

// ============================================
// BOOST PURCHASES TABLE
// Historique des achats de boosts
// ============================================

export const boostPurchasesTable = pgTable('boost_purchases', {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),

    // Détails de l'achat
    pack_type: varchar('pack_type', { length: 20 }).notNull(), // 'single', 'pack_3', 'pack_10', 'custom'
    quantity: integer('quantity').notNull(),
    unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),

    // Statut du paiement
    payment_status: varchar('payment_status', { length: 20 }).default('pending').notNull(), // 'pending', 'paid', 'failed', 'refunded'
    payment_intent_id: varchar('payment_intent_id', { length: 255 }),

    // Traçabilité Stripe
    stripe_session_id: varchar('stripe_session_id', { length: 255 }),
    stripe_customer_id: varchar('stripe_customer_id', { length: 255 }),

    // Métadonnées
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

    paid_at: timestamp('paid_at', { withTimezone: true }),
    refunded_at: timestamp('refunded_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_boost_purchases_user_id').on(table.user_id),
    index('idx_boost_purchases_payment_status').on(table.payment_status),
    index('idx_boost_purchases_payment_intent').on(table.payment_intent_id),
    foreignKey({
        columns: [table.user_id],
        foreignColumns: [usersTable.id],
        name: 'fk_boost_purchases_user_id',
    }).onDelete('cascade'),
]);

export type BoostPurchase = typeof boostPurchasesTable.$inferSelect;
export type NewBoostPurchase = typeof boostPurchasesTable.$inferInsert;

// ============================================
// BOOST PRICES TABLE
// Configuration des prix des packs de boosts
// ============================================

export const boostPricesTable = pgTable('boost_prices', {
    id: uuid('id').primaryKey().defaultRandom(),
    pack_type: varchar('pack_type', { length: 20 }).unique().notNull(),
    quantity: integer('quantity').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    discount_percentage: integer('discount_percentage').default(0),

    // Prix Stripe
    stripe_price_id: varchar('stripe_price_id', { length: 255 }),
    stripe_product_id: varchar('stripe_product_id', { length: 255 }),

    active: boolean('active').default(true),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type BoostPrice = typeof boostPricesTable.$inferSelect;
export type NewBoostPrice = typeof boostPricesTable.$inferInsert;

// ============================================
// BOOST ANALYTICS TABLE
// Analytics et métriques des boosts utilisés
// ============================================

export const boostAnalyticsTable = pgTable('boost_analytics', {
    id: uuid('id').primaryKey().defaultRandom(),
    boost_id: uuid('boost_id').notNull(),
    venue_match_id: uuid('venue_match_id').notNull(),
    user_id: uuid('user_id').notNull(),

    // Métriques de performance
    views_before_boost: integer('views_before_boost').default(0),
    views_during_boost: integer('views_during_boost').default(0),
    views_after_boost: integer('views_after_boost').default(0),

    bookings_before_boost: integer('bookings_before_boost').default(0),
    bookings_during_boost: integer('bookings_during_boost').default(0),
    bookings_after_boost: integer('bookings_after_boost').default(0),

    // Période d'analyse
    boost_started_at: timestamp('boost_started_at', { withTimezone: true }).notNull(),
    boost_ended_at: timestamp('boost_ended_at', { withTimezone: true }),

    // ROI et performance
    estimated_roi: numeric('estimated_roi', { precision: 10, scale: 2 }),
    performance_score: integer('performance_score'), // 0-100

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_boost_analytics_boost_id').on(table.boost_id),
    index('idx_boost_analytics_venue_match_id').on(table.venue_match_id),
    index('idx_boost_analytics_user_id').on(table.user_id),
    foreignKey({
        columns: [table.boost_id],
        foreignColumns: [boostsTable.id],
        name: 'fk_boost_analytics_boost_id',
    }).onDelete('cascade'),
    foreignKey({
        columns: [table.venue_match_id],
        foreignColumns: [venueMatchesTable.id],
        name: 'fk_boost_analytics_venue_match_id',
    }).onDelete('cascade'),
    foreignKey({
        columns: [table.user_id],
        foreignColumns: [usersTable.id],
        name: 'fk_boost_analytics_user_id',
    }).onDelete('cascade'),
]);

export type BoostAnalytics = typeof boostAnalyticsTable.$inferSelect;
export type NewBoostAnalytics = typeof boostAnalyticsTable.$inferInsert;
