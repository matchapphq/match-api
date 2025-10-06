import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const rolesTable = pgTable("roles", {
    id: uuid("id").defaultRandom().primaryKey().unique().notNull(),
    name: text("name").unique().notNull(),
    description: text("description").unique()
})
