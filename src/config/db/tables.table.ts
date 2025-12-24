import { pgTable, varchar, boolean, timestamp, uuid, index, foreignKey, integer, jsonb } from 'drizzle-orm/pg-core';
import { venuesTable } from './venues.table';

export const tablesTable = pgTable('tables', {
    id: uuid('id').primaryKey().defaultRandom(),
    venue_id: uuid('venue_id').notNull(),

    name: varchar('name', { length: 50 }).notNull(), // e.g. "Table 1", "Booth A"
    capacity: integer('capacity').notNull(),
    is_accessible: boolean('is_accessible').default(false),

    // Optional internal location data (x, y coords for map)
    location: jsonb('location'),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
    index('idx_tables_venue_id').on(table.venue_id),
    index('idx_tables_capacity').on(table.capacity),
    foreignKey({
        columns: [table.venue_id],
        foreignColumns: [venuesTable.id],
        name: 'fk_tables_venue_id',
    }).onDelete('cascade'),
]);

export type Table = typeof tablesTable.$inferSelect;
export type NewTable = typeof tablesTable.$inferInsert;
