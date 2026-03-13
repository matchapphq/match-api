import { db } from "../config/config.db";
import { countriesTable, sportsTable, leaguesTable, teamsTable } from "../config/db/sports.table";
import { matchesTable } from "../config/db/matches.table";
import { eq, and, sql, asc, desc, ilike } from "drizzle-orm";
import type { ApiLeagueResponse, ApiTeamResponse, ApiFixtureResponse } from "../lib/api-sports";
import { mapFixtureStatus } from "../lib/api-sports";

// ============================================
// TYPES
// ============================================

export interface PaginationParams {
    page?: number;
    limit?: number;
}

export interface SportsFilterParams extends PaginationParams {
    isActive?: boolean;
}

export interface LeaguesFilterParams extends PaginationParams {
    isActive?: boolean;
    country?: string;
}

export interface TeamsFilterParams extends PaginationParams {
    isActive?: boolean;
}

export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
}

export class SportsRepository {

    // ============================================
    // SPORTS
    // ============================================

    /**
     * Get all sports with pagination and filtering
     */
    async findAllSports(params: SportsFilterParams = {}): Promise<PaginatedResult<any>> {
        const page = Math.max(1, params.page ?? 1);
        const limit = Math.min(100, Math.max(1, params.limit ?? 20));
        const offset = (page - 1) * limit;

        // Build where conditions
        const conditions = [];
        if (params.isActive !== undefined) {
            conditions.push(eq(sportsTable.is_active, params.isActive));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const countResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(sportsTable)
            .where(whereClause);
        const total = countResult[0]?.count ?? 0;

        // Get sports with league count
        const sports = await db.query.sportsTable.findMany({
            where: whereClause,
            orderBy: [asc(sportsTable.display_order), asc(sportsTable.name)],
            limit,
            offset,
            with: {
                leagues: {
                    columns: { id: true },
                },
            },
        });

        // Transform to include league count
        const data = sports.map(sport => ({
            ...sport,
            leagueCount: sport.leagues?.length ?? 0,
            leagues: undefined, // Remove the leagues array
        }));

        const totalPages = Math.ceil(total / limit);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    }

    /**
     * Get sport by ID
     */
    async findSportById(sportId: string) {
        const sport = await db.query.sportsTable.findFirst({
            where: eq(sportsTable.id, sportId),
            with: {
                leagues: {
                    where: eq(leaguesTable.is_active, true),
                    orderBy: [asc(leaguesTable.display_order), asc(leaguesTable.name)],
                },
            },
        });

        if (!sport) return null;

        return {
            ...sport,
            leagueCount: sport.leagues?.length ?? 0,
        };
    }

    /**
     * Get sport by slug
     */
    async findSportBySlug(slug: string) {
        return await db.query.sportsTable.findFirst({
            where: eq(sportsTable.slug, slug),
            with: {
                leagues: {
                    where: eq(leaguesTable.is_active, true),
                },
            },
        });
    }

    // ============================================
    // LEAGUES
    // ============================================

    /**
     * Get leagues for a sport with pagination and filtering
     */
    async findLeaguesBySportId(sportId: string, params: LeaguesFilterParams = {}): Promise<PaginatedResult<any>> {
        const page = Math.max(1, params.page ?? 1);
        const limit = Math.min(100, Math.max(1, params.limit ?? 20));
        const offset = (page - 1) * limit;

        // Build where conditions
        const conditions = [eq(leaguesTable.sport_id, sportId)];
        if (params.isActive !== undefined) {
            conditions.push(eq(leaguesTable.is_active, params.isActive));
        }
        if (params.country) {
            conditions.push(ilike(leaguesTable.country, `%${params.country}%`));
        }

        const whereClause = and(...conditions);

        // Get total count
        const countResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(leaguesTable)
            .where(whereClause);
        const total = countResult[0]?.count ?? 0;

        // Get leagues with team count
        const leagues = await db.query.leaguesTable.findMany({
            where: whereClause,
            orderBy: [asc(leaguesTable.display_order), asc(leaguesTable.name)],
            limit,
            offset,
            with: {
                teams: {
                    columns: { id: true },
                },
            },
        });

        // Transform to include team count
        const data = leagues.map(league => ({
            ...league,
            teamCount: league.teams?.length ?? 0,
            teams: undefined,
        }));

        const totalPages = Math.ceil(total / limit);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    }

    /**
     * Get league by ID
     */
    async findLeagueById(leagueId: string) {
        const league = await db.query.leaguesTable.findFirst({
            where: eq(leaguesTable.id, leagueId),
            with: {
                sport: true,
                teams: {
                    where: eq(teamsTable.is_active, true),
                    orderBy: [asc(teamsTable.name)],
                },
            },
        });

        if (!league) return null;

        return {
            ...league,
            teamCount: league.teams?.length ?? 0,
        };
    }

    /**
     * Get league by slug
     */
    async findLeagueBySlug(slug: string) {
        return await db.query.leaguesTable.findFirst({
            where: eq(leaguesTable.slug, slug),
            with: {
                sport: true,
                teams: {
                    where: eq(teamsTable.is_active, true),
                },
            },
        });
    }

    // ============================================
    // TEAMS
    // ============================================

    /**
     * Get teams for a league with pagination and filtering
     */
    async findTeamsByLeagueId(leagueId: string, params: TeamsFilterParams = {}): Promise<PaginatedResult<any>> {
        const page = Math.max(1, params.page ?? 1);
        const limit = Math.min(100, Math.max(1, params.limit ?? 20));
        const offset = (page - 1) * limit;

        // Build where conditions
        const conditions = [eq(teamsTable.league_id, leagueId)];
        if (params.isActive !== undefined) {
            conditions.push(eq(teamsTable.is_active, params.isActive));
        }

        const whereClause = and(...conditions);

        // Get total count
        const countResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(teamsTable)
            .where(whereClause);
        const total = countResult[0]?.count ?? 0;

        // Get teams
        const teams = await db.query.teamsTable.findMany({
            where: whereClause,
            orderBy: [asc(teamsTable.name)],
            limit,
            offset,
        });

        const totalPages = Math.ceil(total / limit);

        return {
            data: teams,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    }

    /**
     * Get team by ID
     */
    async findTeamById(teamId: string) {
        return await db.query.teamsTable.findFirst({
            where: eq(teamsTable.id, teamId),
            with: {
                league: {
                    with: {
                        sport: true,
                    },
                },
            },
        });
    }

    /**
     * Get team by slug
     */
    async findTeamBySlug(slug: string) {
        return await db.query.teamsTable.findFirst({
            where: eq(teamsTable.slug, slug),
            with: {
                league: {
                    with: {
                        sport: true,
                    },
                },
            },
        });
    }

    // ============================================
    // STATS
    // ============================================

    /**
     * Get counts for dashboard
     */
    async getCounts() {
        const [sportsCount] = await db.select({ count: sql<number>`count(*)::int` })
            .from(sportsTable)
            .where(eq(sportsTable.is_active, true));

        const [leaguesCount] = await db.select({ count: sql<number>`count(*)::int` })
            .from(leaguesTable)
            .where(eq(leaguesTable.is_active, true));

        const [teamsCount] = await db.select({ count: sql<number>`count(*)::int` })
            .from(teamsTable)
            .where(eq(teamsTable.is_active, true));

        return {
            sports: sportsCount?.count ?? 0,
            leagues: leaguesCount?.count ?? 0,
            teams: teamsCount?.count ?? 0,
        };
    }

    // ============================================
    // API-SPORTS SYNC — Upsert from external data
    // ============================================

    /**
     * Upsert a country by name. Returns the internal UUID.
     */
    async upsertCountry(name: string, code?: string | null, flag?: string | null): Promise<string> {
        const existing = await db.query.countriesTable.findFirst({
            where: eq(countriesTable.name, name),
        });

        if (existing) {
            // Update code/flag if provided
            if (code !== undefined || flag !== undefined) {
                await db.update(countriesTable)
                    .set({
                        ...(code !== undefined ? { code } : {}),
                        ...(flag !== undefined ? { flag } : {}),
                        updated_at: new Date(),
                    })
                    .where(eq(countriesTable.id, existing.id));
            }
            return existing.id;
        }

        const [country] = await db.insert(countriesTable).values({
            name,
            code: code ?? null,
            flag: flag ?? null,
        }).returning();

        return country!.id;
    }

    /**
     * Find a country by name.
     */
    async findCountryByName(name: string) {
        return await db.query.countriesTable.findFirst({
            where: eq(countriesTable.name, name),
        });
    }

    /**
     * Get or create the "Football" sport entry (single sport for now).
     * Returns the internal UUID for FK relationships.
     */
    async getOrCreateFootballSport(): Promise<string> {
        const existing = await db.query.sportsTable.findFirst({
            where: eq(sportsTable.slug, "football"),
        });
        if (existing) return existing.id;

        const [sport] = await db.insert(sportsTable).values({
            name: "Football",
            slug: "football",
            description: "Association football (soccer)",
            icon_url: "https://cdn.example.com/icons/football.svg",
            display_order: 1,
            is_active: true,
        }).returning();

        return sport!.id;
    }

    /**
     * Find a league by its API-Sports api_id
     */
    async findLeagueByApiId(apiId: number) {
        return await db.query.leaguesTable.findFirst({
            where: eq(leaguesTable.api_id, apiId),
        });
    }

    /**
     * Find a team by its API-Sports api_id
     */
    async findTeamByApiId(apiId: number) {
        return await db.query.teamsTable.findFirst({
            where: eq(teamsTable.api_id, apiId),
        });
    }

    /**
     * Find a match by its external_id (API-Sports fixture id)
     */
    async findMatchByExternalId(externalId: string) {
        return await db.query.matchesTable.findFirst({
            where: eq(matchesTable.external_id, externalId),
        });
    }

    /**
     * Upsert a league from API-Sports data.
     * Creates or updates based on api_id.
     * Automatically upserts the country and links via country_id.
     */
    async upsertLeagueFromApi(sportId: string, data: ApiLeagueResponse, isMajor: boolean = false): Promise<string> {
        const slug = data.league.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        // Upsert country and get its ID
        const countryId = await this.upsertCountry(
            data.country.name,
            data.country.code,
            data.country.flag,
        );

        const existing = await this.findLeagueByApiId(data.league.id);

        if (existing) {
            await db.update(leaguesTable)
                .set({
                    name: data.league.name,
                    type: data.league.type,
                    logo_url: data.league.logo,
                    country: data.country.name,
                    country_id: countryId,
                    is_major: isMajor || existing.is_major,
                    updated_at: new Date(),
                })
                .where(eq(leaguesTable.id, existing.id));
            return existing.id;
        }

        const [league] = await db.insert(leaguesTable).values({
            sport_id: sportId,
            country_id: countryId,
            api_id: data.league.id,
            name: data.league.name,
            slug: `${slug}-${data.league.id}`,
            type: data.league.type,
            country: data.country.name,
            logo_url: data.league.logo,
            is_major: isMajor,
            is_active: true,
        }).returning();

        return league!.id;
    }

    /**
     * Upsert a team from API-Sports data.
     * Creates or updates based on api_id.
     * Automatically upserts the country and links via country_id.
     */
    async upsertTeamFromApi(leagueId: string, data: ApiTeamResponse): Promise<string> {
        const slug = data.team.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        // Upsert country and get its ID
        const countryId = await this.upsertCountry(data.team.country);

        const existing = await this.findTeamByApiId(data.team.id);

        if (existing) {
            await db.update(teamsTable)
                .set({
                    name: data.team.name,
                    logo_url: data.team.logo,
                    short_code: data.team.code,
                    country_id: countryId,
                    updated_at: new Date(),
                })
                .where(eq(teamsTable.id, existing.id));
            return existing.id;
        }

        const [team] = await db.insert(teamsTable).values({
            league_id: leagueId,
            country_id: countryId,
            api_id: data.team.id,
            name: data.team.name,
            slug: `${slug}-${data.team.id}`,
            short_code: data.team.code,
            country: data.team.country,
            city: data.venue?.city ?? null,
            founded_year: data.team.founded,
            logo_url: data.team.logo,
            is_active: true,
        }).returning();

        return team!.id;
    }

    /**
     * Upsert a match/fixture from API-Sports data.
     * Creates or updates based on external_id (fixture api_id).
     */
    async upsertMatchFromApi(fixture: ApiFixtureResponse, leagueInternalId: string, homeTeamInternalId: string, awayTeamInternalId: string): Promise<string> {
        const externalId = String(fixture.fixture.id);
        const status = mapFixtureStatus(fixture.fixture.status.short);
        const scheduledAt = new Date(fixture.fixture.date);

        const existing = await this.findMatchByExternalId(externalId);

        if (existing) {
            await db.update(matchesTable)
                .set({
                    status,
                    home_team_score: fixture.goals.home,
                    away_team_score: fixture.goals.away,
                    venue_name: fixture.fixture.venue?.name ?? null,
                    updated_at: new Date(),
                    ...(status === "live" && !existing.started_at ? { started_at: new Date() } : {}),
                    ...(status === "finished" && !existing.finished_at ? { finished_at: new Date() } : {}),
                })
                .where(eq(matchesTable.id, existing.id));
            return existing.id;
        }

        const [match] = await db.insert(matchesTable).values({
            league_id: leagueInternalId,
            home_team_id: homeTeamInternalId,
            away_team_id: awayTeamInternalId,
            status,
            scheduled_at: scheduledAt,
            home_team_score: fixture.goals.home,
            away_team_score: fixture.goals.away,
            venue_name: fixture.fixture.venue?.name ?? null,
            round_number: fixture.league.round ? parseInt(fixture.league.round.replace(/\D/g, "")) || null : null,
            external_id: externalId,
        }).returning();

        return match!.id;
    }
}
