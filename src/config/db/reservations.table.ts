import { pgTable, varchar, numeric, boolean, timestamp, uuid, index, foreignKey, integer, text } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { venueMatchesTable } from './matches.table';
import { reservationStatusEnum } from './enums';
import { tablesTable } from './tables.table';

// ============================================
// 15. RESERVATIONS TABLE
// ============================================

export const reservationsTable = pgTable(
    'reservations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),
        venue_match_id: uuid('venue_match_id').notNull(),

        // Table Reservation
        table_id: uuid('table_id'), // Nullable if seat-based, but we are moving to table-based primarily? Or hybrid? Plan says "Restaurant Style".
        party_size: integer('party_size'),

        status: reservationStatusEnum('status').default('pending').notNull(),

        // Seats
        seat_ids: text('seat_ids').array().notNull(),
        quantity: integer('quantity').notNull(),

        // Pricing (Defaults to 0.00 for pay-at-venue)
        unit_price: numeric('unit_price', { precision: 10, scale: 2 }).default('0.00').notNull(),
        total_price: numeric('total_price', { precision: 10, scale: 2 }).default('0.00').notNull(),
        discount_applied: numeric('discount_applied', { precision: 10, scale: 2 }).default('0.00'),
        final_price: numeric('final_price', { precision: 10, scale: 2 }).default('0.00').notNull(),

        // Deposit (if applicable)
        deposit_required: numeric('deposit_required', { precision: 10, scale: 2 }),
        deposit_paid: boolean('deposit_paid').default(false),

        // Special requests
        special_requests: text('special_requests'),

        // Times
        checked_in_at: timestamp('checked_in_at', { withTimezone: true }),
        completed_at: timestamp('completed_at', { withTimezone: true }),
        canceled_at: timestamp('canceled_at', { withTimezone: true }),
        canceled_reason: varchar('canceled_reason', { length: 255 }),

        // QR Code for check-in
        qr_code: varchar('qr_code', { length: 255 }).unique(),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_reservations_user_id').on(table.user_id),
        index('idx_reservations_venue_match_id').on(table.venue_match_id),
        index('idx_reservations_status').on(table.status),
        index('idx_reservations_created_at').on(table.created_at),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_reservations_user_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.venue_match_id],
            foreignColumns: [venueMatchesTable.id],
            name: 'fk_reservations_venue_match_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.table_id],
            foreignColumns: [tablesTable.id],
            name: 'fk_reservations_table_id',
        }).onDelete('set null'),
    ]
);

export type Reservation = typeof reservationsTable.$inferSelect;
export type NewReservation = typeof reservationsTable.$inferInsert;
