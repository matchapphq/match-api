import { pgTable, varchar, numeric, boolean, timestamp, uuid, index, foreignKey, integer, text, unique } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { venueMatchesTable } from './matches.table';
import { venuesTable } from './venues.table';
import { seatTypeEnum, seatStatusEnum } from './enums';

// ============================================
// 13. SEAT HOLDS TABLE (LEGACY - Consider using table_holds instead)
// This was designed for ticketing. For restaurant-style reservations,
// use the table_holds table which tracks table reservations by party size.
// ============================================

export const seatHoldsTable = pgTable(
    'seat_holds',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),
        venue_match_id: uuid('venue_match_id').notNull(),

        // Seats being held
        seat_ids: text('seat_ids').array().notNull(),
        quantity: integer('quantity').notNull(),

        // Hold expiry
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),

        // Conversion
        converted_to_reservation_id: uuid('converted_to_reservation_id'),
        reason_for_release: varchar('reason_for_release', { length: 255 }),

    },
    (table) => [
        index('idx_seat_holds_user_id').on(table.user_id),
        index('idx_seat_holds_venue_match_id').on(table.venue_match_id),
        index('idx_seat_holds_expires_at').on(table.expires_at),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_seat_holds_user_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.venue_match_id],
            foreignColumns: [venueMatchesTable.id],
            name: 'fk_seat_holds_venue_match_id',
        }).onDelete('cascade'),
    ]
);

export type SeatHold = typeof seatHoldsTable.$inferSelect;
export type NewSeatHold = typeof seatHoldsTable.$inferInsert;

// ============================================
// 14. SEATS TABLE
// ============================================

export const seatsTable = pgTable(
    'seats',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        venue_id: uuid('venue_id').notNull(),
        venue_match_id: uuid('venue_match_id'),

        seat_number: varchar('seat_number', { length: 50 }).notNull(),
        section: varchar('section', { length: 50 }),
        row: varchar('row', { length: 10 }),
        column: varchar('column', { length: 10 }),

        seat_type: seatTypeEnum('seat_type').default('standard').notNull(),
        status: seatStatusEnum('status').default('available').notNull(),

        is_accessible: boolean('is_accessible').default(false),

        // Seat hold tracking
        hold_id: uuid('hold_id'),
        hold_expires_at: timestamp('hold_expires_at', { withTimezone: true }),

        // Blocking
        blocked_reason: varchar('blocked_reason', { length: 255 }),
        blocked_until: timestamp('blocked_until', { withTimezone: true }),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_seats_venue_id').on(table.venue_id),
        index('idx_seats_status').on(table.status),
        index('idx_seats_hold_expires').on(table.hold_expires_at),
        unique('unique_seat_per_venue').on(table.venue_id, table.seat_number),
        foreignKey({
            columns: [table.venue_id],
            foreignColumns: [venuesTable.id],
            name: 'fk_seats_venue_id',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.venue_match_id],
            foreignColumns: [venueMatchesTable.id],
            name: 'fk_seats_venue_match_id',
        }).onDelete('set null'),
    ]
);

export type Seat = typeof seatsTable.$inferSelect;
export type NewSeat = typeof seatsTable.$inferInsert;
