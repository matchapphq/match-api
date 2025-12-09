import { pgTable, varchar, boolean, timestamp, uuid, index, foreignKey, integer, text } from 'drizzle-orm/pg-core';
import { venues } from './venues.table';

// ============================================
// 7. VENUE PHOTOS TABLE
// ============================================

export const venuePhotos = pgTable(
    'venue_photos',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        venue_id: uuid('venue_id').notNull(),

        photo_url: text('photo_url').notNull(),
        alt_text: varchar('alt_text', { length: 255 }),
        is_primary: boolean('is_primary').default(false),
        display_order: integer('display_order').default(0),

        uploaded_by: uuid('uploaded_by'),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_venue_photos_venue_id').on(table.venue_id),
        index('idx_venue_photos_is_primary').on(table.is_primary),
        foreignKey({
            columns: [table.venue_id],
            foreignColumns: [venues.id],
            name: 'fk_venue_photos_venue_id',
        }).onDelete('cascade'),
    ]
);

export type VenuePhoto = typeof venuePhotos.$inferSelect;
export type NewVenuePhoto = typeof venuePhotos.$inferInsert;
