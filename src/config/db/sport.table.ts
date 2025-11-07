import { pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const sportTable = pgTable("sport", {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    api_id: text("api_id").notNull().unique(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    created_at: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export const leagueTable = pgTable("league", {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    api_id: text("api_id").notNull().unique(),
    sport_id: uuid("sport_id").references(() => sportTable.id).notNull().unique(),
    name: text("name").notNull().unique(),
    country: text("country").notNull().unique(),
    logo_url: text("logo_url").notNull().unique(),
    season: text("season").notNull().unique(),
    created_at: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export const teamTable = pgTable("team", {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    api_id: text("api_id").notNull().unique(),
    sport_id: uuid("sport_id").references(() => sportTable.id).notNull().unique(),
    name: text("name").notNull().unique(),
    logo_url: text("logo_url").notNull().unique(),
    country: text("country").notNull().unique(),
    created_at: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export const matchTable = pgTable("match", {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    api_id: text("api_id").notNull().unique(),
    sport_id: uuid("sport_id").references(() => sportTable.id).notNull().unique(),
    name: text("name").notNull().unique(),
    league_id: uuid("league_id").references(() => leagueTable.id).notNull().unique(),
    home_team_id: uuid("home_team_id").references(() => teamTable.id).notNull().unique(),
    away_team_id: uuid("away_team_id").references(() => teamTable.id).notNull().unique(),
    match_date: timestamp("match_date", { withTimezone: true, mode: "date" }).defaultNow(),
    status: text("status").notNull().unique(),
    home_score: serial("home_score").notNull().unique(),
    away_score: serial("away_score").notNull().unique(),
    venue_name: text("venue_name").notNull().unique(),
    created_at: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .$onUpdate(() => new Date()),
});