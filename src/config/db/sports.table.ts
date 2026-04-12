import {
    pgTable,
    varchar,
    boolean,
    timestamp,
    uuid,
    index,
    foreignKey,
    integer,
    text,
    primaryKey,
} from "drizzle-orm/pg-core";

// ============================================
// 7. COUNTRIES TABLE
// ============================================

export const countriesTable = pgTable(
    "countries",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        name: varchar("name", { length: 100 }).notNull().unique(),
        code: varchar("code", { length: 10 }), // ISO code e.g. "GB", "ES"
        flag: text("flag"), // Flag URL from API-Sports

        created_at: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updated_at: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [index("idx_countries_name").on(table.name)],
);

export type Country = typeof countriesTable.$inferSelect;
export type NewCountry = typeof countriesTable.$inferInsert;

// ============================================
// 8. SPORTS TABLE
// ============================================

export const sportsTable = pgTable(
    "sports",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        api_id: integer("api_id").unique(), // API-Sports external ID (e.g. football = null for now)
        name: varchar("name", { length: 100 }).notNull().unique(),
        slug: varchar("slug", { length: 100 }).notNull().unique(),
        description: text("description"),
        icon_url: text("icon_url"),

        is_active: boolean("is_active").default(true),
        display_order: integer("display_order").default(0),

        created_at: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updated_at: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_sports_slug").on(table.slug),
        index("idx_sports_is_active").on(table.is_active),
    ],
);

export type Sport = typeof sportsTable.$inferSelect;
export type NewSport = typeof sportsTable.$inferInsert;

// ============================================
// 9. LEAGUES TABLE
// ============================================

export const leaguesTable = pgTable(
    "leagues",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        sport_id: uuid("sport_id").notNull(),

        country_id: uuid("country_id"),

        api_id: integer("api_id").unique(), // API-Sports league ID (e.g. 39 = Premier League)
        name: varchar("name", { length: 150 }).notNull(),
        slug: varchar("slug", { length: 150 }).notNull().unique(),
        type: varchar("type", { length: 20 }), // "League", "Cup", etc.
        country: varchar("country", { length: 100 }), // kept for backward compat
        description: text("description"),
        logo_url: text("logo_url"),

        is_major: boolean("is_major").default(false),
        is_active: boolean("is_active").default(true),
        display_order: integer("display_order").default(0),

        created_at: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updated_at: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_leagues_sport_id").on(table.sport_id),
        index("idx_leagues_slug").on(table.slug),
        index("idx_leagues_is_active").on(table.is_active),
        foreignKey({
            columns: [table.sport_id],
            foreignColumns: [sportsTable.id],
            name: "fk_leagues_sport_id",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.country_id],
            foreignColumns: [countriesTable.id],
            name: "fk_leagues_country_id",
        }).onDelete("set null"),
    ],
);

export type League = typeof leaguesTable.$inferSelect;
export type NewLeague = typeof leaguesTable.$inferInsert;

// ============================================
// 10. TEAMS TABLE
// ============================================

export const teamsTable = pgTable("teams", {
        id: uuid("id").primaryKey().defaultRandom(),

        country_id: uuid("country_id"),

        api_id: integer("api_id").unique(), // API-Sports team ID (e.g. 33 = Man Utd)
        name: varchar("name", { length: 150 }).notNull(),
        slug: varchar("slug", { length: 150 }).notNull().unique(),
        short_code: varchar("short_code", { length: 10 }), // e.g. "MUN"
        country: varchar("country", { length: 100 }), // kept for backward compat
        city: varchar("city", { length: 100 }),
        description: text("description"),
        logo_url: text("logo_url"),
        founded_year: integer("founded_year"),

        is_active: boolean("is_active").default(true),

        created_at: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updated_at: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_teams_slug").on(table.slug),
        index("idx_teams_is_active").on(table.is_active),
        foreignKey({
            columns: [table.country_id],
            foreignColumns: [countriesTable.id],
            name: "fk_teams_country_id",
        }).onDelete("set null"),
    ],
);

export type Team = typeof teamsTable.$inferSelect;
export type NewTeam = typeof teamsTable.$inferInsert;

// ============================================
// 11. TEAM LEAGUES TABLE
// ============================================

export const teamLeaguesTable = pgTable("team_leagues", {
        team_id: uuid("team_id").notNull(),
        league_id: uuid("league_id").notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.team_id, table.league_id] }),
        index("idx_team_leagues_team_id").on(table.team_id),
        index("idx_team_leagues_league_id").on(table.league_id),
        foreignKey({
            columns: [table.team_id],
            foreignColumns: [teamsTable.id],
            name: "fk_team_leagues_team_id",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.league_id],
            foreignColumns: [leaguesTable.id],
            name: "fk_team_leagues_league_id",
        }).onDelete("cascade"),
    ],
);

export type TeamLeague = typeof teamLeaguesTable.$inferSelect;
export type NewTeamLeague = typeof teamLeaguesTable.$inferInsert;
