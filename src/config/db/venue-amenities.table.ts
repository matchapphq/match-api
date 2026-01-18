import {
    pgTable,
    varchar,
    timestamp,
    uuid,
    index,
    foreignKey,
    text,
    boolean,
    integer,
} from 'drizzle-orm/pg-core';
import { venuesTable } from './venues.table';

// ============================================
// AMENITIES TABLE (Reference table)
// ============================================

export const amenitiesTable = pgTable('amenities', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    icon: varchar('icon', { length: 50 }).notNull(), // lucide-react icon name
    category: varchar('category', { length: 50 }).notNull(), // 'facilities', 'accessibility', 'services'
    description: text('description'),
    display_order: integer('display_order').default(0),
    is_active: boolean('is_active').default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_amenities_slug').on(table.slug),
    index('idx_amenities_category').on(table.category),
]);

export type Amenity = typeof amenitiesTable.$inferSelect;
export type NewAmenity = typeof amenitiesTable.$inferInsert;

// ============================================
// VENUE AMENITIES (Junction table)
// ============================================

export const venueAmenitiesTable = pgTable('venue_amenities', {
    id: uuid('id').primaryKey().defaultRandom(),
    venue_id: uuid('venue_id').notNull(),
    amenity_id: uuid('amenity_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_venue_amenities_venue_id').on(table.venue_id),
    index('idx_venue_amenities_amenity_id').on(table.amenity_id),
    foreignKey({
        columns: [table.venue_id],
        foreignColumns: [venuesTable.id],
        name: 'fk_venue_amenities_venue_id',
    }).onDelete('cascade'),
    foreignKey({
        columns: [table.amenity_id],
        foreignColumns: [amenitiesTable.id],
        name: 'fk_venue_amenities_amenity_id',
    }).onDelete('cascade'),
]);

export type VenueAmenity = typeof venueAmenitiesTable.$inferSelect;
export type NewVenueAmenity = typeof venueAmenitiesTable.$inferInsert;

// ============================================
// OPENING HOURS EXCEPTIONS
// ============================================

export const openingHoursExceptionsTable = pgTable('opening_hours_exceptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    venue_id: uuid('venue_id').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    reason: varchar('reason', { length: 255 }).notNull(),
    closed: boolean('closed').default(false).notNull(),
    special_open: varchar('special_open', { length: 5 }), // "HH:mm" format
    special_close: varchar('special_close', { length: 5 }), // "HH:mm" format
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_opening_hours_exceptions_venue_id').on(table.venue_id),
    index('idx_opening_hours_exceptions_date').on(table.date),
    foreignKey({
        columns: [table.venue_id],
        foreignColumns: [venuesTable.id],
        name: 'fk_opening_hours_exceptions_venue_id',
    }).onDelete('cascade'),
]);

export type OpeningHoursException = typeof openingHoursExceptionsTable.$inferSelect;
export type NewOpeningHoursException = typeof openingHoursExceptionsTable.$inferInsert;
