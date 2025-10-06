import { pgEnum, pgTable, text, timestamp, uniqueIndex, index, doublePrecision, uuid } from "drizzle-orm/pg-core";
import { rolesTable } from "./roles.table";

const statusEnum = pgEnum("statusEnum", ["pending", "active", "deleted", "banned"])

export const userTable = pgTable("user", {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone").unique(),
    password_hash: text("password").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    username: text("username").notNull().unique(),
    status: statusEnum("status").default("pending"),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (table) => [
    uniqueIndex("users_id_idx").on(table.id),
    uniqueIndex("user_email_idx").on(table.email)
]);

export const user_preferences = pgTable("user_preferences", {
    user_id: uuid("user_id").references(() => userTable.id),
    homeLat: doublePrecision("home_lat"), 
    homeLng: doublePrecision("home_lng"),
    homeCity: text("home_city"),
    favSports: text("fav_sports").array(),
    favTeamIds: text("fav_team_ids").array(),
})


export const userRolesTables = pgTable("user_roles", {
    user_id: uuid("userID").references(() => userTable.id).notNull().unique(),
    roles_id: uuid("rolesID").references(() => rolesTable.id).notNull().unique()
})