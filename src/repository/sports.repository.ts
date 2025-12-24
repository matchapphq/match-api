import { db } from "../config/config.db";
import { sportsTable, leaguesTable, teamsTable } from "../config/db/sports.table";
import { eq, and, sql, asc, desc, ilike } from "drizzle-orm";

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
                    columns: { id: true }
                }
            }
        });

        // Transform to include league count
        const data = sports.map(sport => ({
            ...sport,
            leagueCount: sport.leagues?.length ?? 0,
            leagues: undefined // Remove the leagues array
        }));

        const totalPages = Math.ceil(total / limit);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages
            }
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
                    orderBy: [asc(leaguesTable.display_order), asc(leaguesTable.name)]
                }
            }
        });

        if (!sport) return null;

        return {
            ...sport,
            leagueCount: sport.leagues?.length ?? 0
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
                    where: eq(leaguesTable.is_active, true)
                }
            }
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
                    columns: { id: true }
                }
            }
        });

        // Transform to include team count
        const data = leagues.map(league => ({
            ...league,
            teamCount: league.teams?.length ?? 0,
            teams: undefined
        }));

        const totalPages = Math.ceil(total / limit);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages
            }
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
                    orderBy: [asc(teamsTable.name)]
                }
            }
        });

        if (!league) return null;

        return {
            ...league,
            teamCount: league.teams?.length ?? 0
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
                    where: eq(teamsTable.is_active, true)
                }
            }
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
            offset
        });

        const totalPages = Math.ceil(total / limit);

        return {
            data: teams,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages
            }
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
                        sport: true
                    }
                }
            }
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
                        sport: true
                    }
                }
            }
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
            teams: teamsCount?.count ?? 0
        };
    }
}
