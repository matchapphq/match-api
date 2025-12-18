import { pgTable, varchar, timestamp, uuid, index, foreignKey, integer } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { tablesTable } from './tables.table';
import { venueMatchesTable } from './matches.table';

export const tableHoldsTable = pgTable('table_holds', {
    id: uuid('id').primaryKey().defaultRandom(),

    user_id: uuid('user_id').notNull(),
    table_id: uuid('table_id').notNull(),
    venue_match_id: uuid('venue_match_id').notNull(),

    party_size: integer('party_size').notNull(),

    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_table_holds_user_id').on(table.user_id),
    index('idx_table_holds_table_id').on(table.table_id),
    index('idx_table_holds_match_id').on(table.venue_match_id),
    foreignKey({
        columns: [table.user_id],
        foreignColumns: [usersTable.id],
        name: 'fk_table_holds_user_id',
    }).onDelete('cascade'),
    foreignKey({
        columns: [table.table_id],
        foreignColumns: [tablesTable.id],
        name: 'fk_table_holds_table_id',
    }).onDelete('cascade'),
    foreignKey({
        columns: [table.venue_match_id],
        foreignColumns: [venueMatchesTable.id],
        name: 'fk_table_holds_match_id',
    }).onDelete('cascade'),
]);

export type TableHold = typeof tableHoldsTable.$inferSelect;
export type NewTableHold = typeof tableHoldsTable.$inferInsert;
