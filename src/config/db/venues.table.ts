import {
    pgTable,
    varchar,
    numeric,
    boolean,
    timestamp,
    uuid,
    index,
    foreignKey,
    integer,
    text,
    jsonb,
    doublePrecision,
    geometry
} from 'drizzle-orm/pg-core';
import { sql as drizzleSql } from 'drizzle-orm';
import { usersTable } from './user.table';
import { subscriptionsTable } from './subscriptions.table';
import { venueTypeEnum, venueStatusEnum, subscriptionLevelEnum, subscriptionStatusEnum } from './enums';

// ============================================
// TYPES
// ============================================

export interface OpeningHourPeriod {
    open: string;
    close: string;
}

export interface DaySchedule {
    day_of_week: number;
    is_closed: boolean;
    periods: OpeningHourPeriod[];
}

export type OpeningHours = DaySchedule[];

export interface MenuItem {
    name: string;
    description?: string;
    price: number;
    currency: string;
    category?: string;
    image_url?: string;
    is_available: boolean;
    allergens?: string[];
}

export type VenueMenu = MenuItem[];

export interface VerificationDocument {
    type: 'business_license' | 'liquor_license' | 'insurance' | 'id_proof' | 'other';
    url: string;
    uploaded_at: string;
    status: 'pending' | 'verified' | 'rejected';
    rejection_reason?: string;
}

export type VerificationDocuments = VerificationDocument[];

// ============================================
// 6. VENUES TABLE
// ============================================

export const venuesTable = pgTable('venues', {
        id: uuid('id').primaryKey().defaultRandom(),
        owner_id: uuid('owner_id').notNull(),
        subscription_id: uuid('subscription_id').notNull(),

        // Basic Info
        name: varchar('name', { length: 255 }).notNull(),
        description: text('description'),
        type: venueTypeEnum('type').notNull(),

        // Address & Geolocation
        street_address: varchar('street_address', { length: 255 }).notNull(),
        city: varchar('city', { length: 100 }).notNull(),
        state_province: varchar('state_province', { length: 100 }),
        postal_code: varchar('postal_code', { length: 20 }).notNull(),
        country: varchar('country', { length: 100 }).notNull(),

        // PostGIS
        location: geometry('location', { mode: 'xy' }).notNull(),
        latitude: doublePrecision('latitude'),
        longitude: doublePrecision('longitude'),

        // Contact & Social
        phone: varchar('phone', { length: 20 }),
        email: varchar('email', { length: 255 }),
        website: varchar('website', { length: 255 }),
        instagram: varchar('instagram', { length: 255 }),
        facebook: varchar('facebook', { length: 255 }),
        tiktok: varchar('tiktok', { length: 255 }),

        // Operating Info
        opening_hours: jsonb('opening_hours').$type<OpeningHours>(),
        capacity: integer('capacity'),
        has_terrace: boolean('has_terrace').default(false),
        has_wifi: boolean('has_wifi').default(false),
        has_parking: boolean('has_parking').default(false),
        has_wheelchair_access: boolean('has_wheelchair_access').default(false),

        // Menu 
        menu: jsonb('menu').default(drizzleSql`'[]'::jsonb`).$type<VenueMenu>(),

        // Media
        logo_url: text('logo_url'),
        cover_image_url: text('cover_image_url'),

        // Subscription & Access
        subscription_status: subscriptionStatusEnum('subscription_status').default('active').notNull(),
        subscription_level: subscriptionLevelEnum('subscription_level').default('basic'),

        // Status
        status: venueStatusEnum('status').default('pending').notNull(),
        is_active: boolean('is_active').default(true),
        is_verified: boolean('is_verified').default(false),
        verification_documents: jsonb('verification_documents').$type<VerificationDocuments>(),

        // Stats
        average_rating: numeric('average_rating', { precision: 3, scale: 2 }).default('0.00'),
        total_reviews: integer('total_reviews').default(0),
        total_reservations: integer('total_reservations').default(0),

        // Metadata
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deleted_at: timestamp('deleted_at', { withTimezone: true }),
    }, (table) => [
        index('idx_venues_owner_id').on(table.owner_id),
        index('idx_venues_subscription_id').on(table.subscription_id),
        index('idx_venues_status').on(table.status),
        index('idx_venues_city').on(table.city),
        index('idx_venues_is_active').on(table.is_active),
        foreignKey({
            columns: [table.owner_id],
            foreignColumns: [usersTable.id],
            name: 'fk_venues_owner_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.subscription_id],
            foreignColumns: [subscriptionsTable.id],
            name: 'fk_venues_subscription_id',
            // .onDelete('restrict') might be cleaner, keeping original logic
        }).onDelete('restrict'),
    ]
);

export type Venue = typeof venuesTable.$inferSelect;
export type NewVenue = typeof venuesTable.$inferInsert;