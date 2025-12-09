import { pgTable, varchar, boolean, timestamp, uuid, index, foreignKey } from 'drizzle-orm/pg-core';
import { users } from './user.table';

// ============================================
// 5. USER ADDRESSES TABLE
// ============================================

export const userAddresses = pgTable(
    'user_addresses',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),

        street_address: varchar('street_address', { length: 255 }).notNull(),
        city: varchar('city', { length: 100 }).notNull(),
        state_province: varchar('state_province', { length: 100 }),
        postal_code: varchar('postal_code', { length: 20 }).notNull(),
        country: varchar('country', { length: 100 }).notNull(),

        is_default: boolean('is_default').default(false),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_user_addresses_user_id').on(table.user_id),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [users.id],
            name: 'fk_user_addresses_user_id',
        }).onDelete('cascade'),
    ]
);

export type UserAddress = typeof userAddresses.$inferSelect;
export type NewUserAddress = typeof userAddresses.$inferInsert;
