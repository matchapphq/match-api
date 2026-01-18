import { pgTable, varchar, boolean, timestamp, uuid, index, foreignKey, integer, text, unique } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { venuesTable } from './venues.table';

// ============================================
// 16. REVIEWS TABLE
// ============================================

export const reviewsTable = pgTable(
    'reviews',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),
        venue_id: uuid('venue_id').notNull(),

        rating: integer('rating').notNull(),
        title: varchar('title', { length: 200 }).notNull(),
        content: text('content').notNull(),

        // Review aspects
        atmosphere_rating: integer('atmosphere_rating'),
        food_rating: integer('food_rating'),
        service_rating: integer('service_rating'),
        value_rating: integer('value_rating'),

        // Metadata
        helpful_count: integer('helpful_count').default(0),
        unhelpful_count: integer('unhelpful_count').default(0),

        is_verified_purchase: boolean('is_verified_purchase').default(false),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deleted_at: timestamp('deleted_at', { withTimezone: true }),
    },
    (table) => [
        index('idx_reviews_user_id').on(table.user_id),
        index('idx_reviews_venue_id').on(table.venue_id),
        index('idx_reviews_rating').on(table.rating),
        index('idx_reviews_created_at').on(table.created_at),
        unique('unique_user_venue_review').on(table.user_id, table.venue_id),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_reviews_user_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.venue_id],
            foreignColumns: [venuesTable.id],
            name: 'fk_reviews_venue_id',
        }).onDelete('cascade'),
    ]
);

export type Review = typeof reviewsTable.$inferSelect;
export type NewReview = typeof reviewsTable.$inferInsert;

// ============================================
// 17. REVIEW HELPFUL VOTES
// ============================================

export const reviewHelpfulTable = pgTable(
    'review_helpful',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        review_id: uuid('review_id').notNull(),
        user_id: uuid('user_id').notNull(),

        is_helpful: boolean('is_helpful').notNull(),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_review_helpful_review_id').on(table.review_id),
        index('idx_review_helpful_user_id').on(table.user_id),
        unique('unique_review_user_helpful').on(table.review_id, table.user_id),
        foreignKey({
            columns: [table.review_id],
            foreignColumns: [reviewsTable.id],
            name: 'fk_review_helpful_review_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_review_helpful_user_id',
        }).onDelete('cascade'),
    ]
);

export type ReviewHelpful = typeof reviewHelpfulTable.$inferSelect;
export type NewReviewHelpful = typeof reviewHelpfulTable.$inferInsert;
