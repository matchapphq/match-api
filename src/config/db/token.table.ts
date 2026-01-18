import { pgTable, uuid, text, timestamp, index, foreignKey } from "drizzle-orm/pg-core"
import { usersTable } from "./user.table"

export const tokenTable = pgTable("tokens", {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    userId: uuid("user_id").notNull(),
    hash_token: text("hash_token").notNull(),
    device: text("device").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
    index('idx_users_id').on(table.userId),
    foreignKey({
        columns: [table.userId],
        foreignColumns: [usersTable.id],
        name: "fk_token_users_id"
    }).onDelete('cascade')
])
