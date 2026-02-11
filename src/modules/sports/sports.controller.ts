import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { z } from "zod";
import { SportsLogic } from "./sports.logic";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const SportsQuerySchema = PaginationSchema.extend({
    is_active: z.enum(['true', 'false']).optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
});

const LeaguesQuerySchema = PaginationSchema.extend({
    is_active: z.enum(['true', 'false']).optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
    country: z.string().optional(),
});

const TeamsQuerySchema = PaginationSchema.extend({
    is_active: z.enum(['true', 'false']).optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
});

const FixtureQuerySchema = PaginationSchema.extend({
    sport_id: z.string().uuid().optional(),
    league_id: z.string().uuid().optional(),
    date: z.string().optional(),
    status: z.enum(["scheduled", "live", "finished"]).optional()
});

// API-Sports direct query schemas
const ApiLeaguesQuerySchema = z.object({
    country: z.string().optional(),
    season: z.string().optional(),
    search: z.string().optional(),
    type: z.string().optional(),
    current: z.string().optional(),
});

const ApiTeamsQuerySchema = z.object({
    league: z.string().optional(),
    season: z.string().optional(),
    search: z.string().optional(),
    country: z.string().optional(),
});

const ApiFixturesQuerySchema = z.object({
    league: z.string().optional(),
    date: z.string().optional(),
    team: z.string().optional(),
    season: z.string().optional(),
    live: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    next: z.string().optional(),
    last: z.string().optional(),
    status: z.string().optional(),
});

const ApiCountriesQuerySchema = z.object({
    search: z.string().optional(),
});


/**
 * Controller for Sports operations.
 * Handles fetching sports, leagues, and teams.
 * 
 * DB-backed endpoints: /sports, /sports/:sportId, /sports/:sportId/leagues,
 *                      /leagues/:leagueId, /leagues/:leagueId/teams, /teams/:teamId
 * 
 * API-Sports endpoints: /football/countries, /football/leagues, /football/teams, /football/fixtures
 */
class SportsController {
    private readonly factory = createFactory();

    constructor(private readonly sportsLogic: SportsLogic) {}

    // ============================================
    // DB-BACKED ENDPOINTS (existing)
    // ============================================

    /**
     * GET /sports - List all sports with pagination
     */
    public readonly getSports = this.factory.createHandlers(validator('query', (value, c) => {
        const parsed = SportsQuerySchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid query params", details: parsed.error }, 400);
        }
        return parsed.data;
    }), async (c) => {
        try {
            const { page, limit, is_active } = c.req.valid('query');
            const result = await this.sportsLogic.getSports(page, limit, is_active);
            return c.json(result);
        } catch (error: any) {
            console.error("Error fetching sports:", error);
            return c.json({ error: "Failed to fetch sports" }, 500);
        }
    });
    
    /**
     * GET /sports/fixture - Get team fixtures (legacy)
     */
    public readonly getFixtures = this.factory.createHandlers(validator("query", (value, c) => {
        const parsed = FixtureQuerySchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid query params", details: parsed.error }, 400);
        }
        return parsed.data;
    }), async (c) => {
        const query = c.req.valid("query");
        try {
             const result = await this.sportsLogic.getFixtures(query);
             return c.json(result);
        } catch (error: any) {
            console.error("Error fetching team fixtures:", error);
            return c.json({ error: "Failed to fetch team fixtures" }, 500);
        }
    });

    /**
     * GET /sports/:sportId - Get sport details
     */
    readonly getSportById = this.factory.createHandlers(async (c) => {
        try {
            const sportId = c.req.param("sportId");
            if (!sportId) return c.json({ error: "Sport ID required" }, 400);

            const sport = await this.sportsLogic.getSportById(sportId);
            return c.json(sport);
        } catch (error: any) {
            if (error.message === "SPORT_NOT_FOUND") return c.json({ error: "Sport not found" }, 404);
            console.error("Error fetching sport:", error);
            return c.json({ error: "Failed to fetch sport" }, 500);
        }
    });

    /**
     * GET /sports/:sportId/leagues - Get leagues for a sport with pagination
     */
    readonly getLeaguesBySport = this.factory.createHandlers(validator('query', (value, c) => {
        const parsed = LeaguesQuerySchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid query params", details: parsed.error }, 400);
        }
        return parsed.data;
    }), async (c) => {
        try {
            const sportId = c.req.param("sportId");
            if (!sportId) return c.json({ error: "Sport ID required" }, 400);

            const { page, limit, is_active, country } = c.req.valid('query');
            const result = await this.sportsLogic.getLeaguesBySport(sportId, page, limit, is_active, country);
            return c.json(result);
        } catch (error: any) {
            if (error.message === "SPORT_NOT_FOUND") return c.json({ error: "Sport not found" }, 404);
            console.error("Error fetching leagues:", error);
            return c.json({ error: "Failed to fetch leagues" }, 500);
        }
    });

    // ============================================
    // LEAGUES ENDPOINTS (DB-backed)
    // ============================================

    /**
     * GET /leagues/:leagueId - Get league details
     */
    readonly getLeagueById = this.factory.createHandlers(async (c) => {
        try {
            const leagueId = c.req.param("leagueId");
            if (!leagueId) return c.json({ error: "League ID required" }, 400);

            const league = await this.sportsLogic.getLeagueById(leagueId);
            return c.json(league);
        } catch (error: any) {
            if (error.message === "LEAGUE_NOT_FOUND") return c.json({ error: "League not found" }, 404);
            console.error("Error fetching league:", error);
            return c.json({ error: "Failed to fetch league" }, 500);
        }
    });

    /**
     * GET /leagues/:leagueId/teams - Get teams for a league with pagination
     */
    readonly getTeamsByLeague = this.factory.createHandlers(validator('query', (value, c) => {
        const parsed = TeamsQuerySchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid query params", details: parsed.error }, 400);
        }
        return parsed.data;
    }), async (c) => {
        try {
            const leagueId = c.req.param("leagueId");
            if (!leagueId) return c.json({ error: "League ID required" }, 400);

            const { page, limit, is_active } = c.req.valid('query');
            const result = await this.sportsLogic.getTeamsByLeague(leagueId, page, limit, is_active);
            return c.json(result);
        } catch (error: any) {
            if (error.message === "LEAGUE_NOT_FOUND") return c.json({ error: "League not found" }, 404);
            console.error("Error fetching teams:", error);
            return c.json({ error: "Failed to fetch teams" }, 500);
        }
    });

    // ============================================
    // TEAMS ENDPOINTS (DB-backed)
    // ============================================

    /**
     * GET /teams/:teamId - Get team details
     */
    readonly getTeamById = this.factory.createHandlers(async (c) => {
        try {
            const teamId = c.req.param("teamId");
            if (!teamId) return c.json({ error: "Team ID required" }, 400);

            const team = await this.sportsLogic.getTeamById(teamId);
            return c.json(team);
        } catch (error: any) {
            if (error.message === "TEAM_NOT_FOUND") return c.json({ error: "Team not found" }, 404);
            console.error("Error fetching team:", error);
            return c.json({ error: "Failed to fetch team" }, 500);
        }
    });

    // ============================================
    // API-SPORTS LIVE ENDPOINTS (real data, no cache)
    // ============================================

    /**
     * GET /football/countries - Fetch countries from API-Sports
     * Query: ?search=engl
     */
    readonly fetchCountries = this.factory.createHandlers(validator('query', (value, c) => {
        const parsed = ApiCountriesQuerySchema.safeParse(value);
        if (!parsed.success) return c.json({ error: "Invalid query params", details: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        try {
            const { search } = c.req.valid('query');
            const result = await this.sportsLogic.getCountries(search);
            return c.json({ data: result, count: result.length });
        } catch (error: any) {
            console.error("Error fetching countries:", error);
            return c.json({ error: "Failed to fetch countries from API-Sports" }, 500);
        }
    });

    /**
     * GET /football/leagues - Fetch leagues from API-Sports
     * Query: ?country=england&season=2024&search=premier&type=league&current=true
     */
    readonly fetchLeagues = this.factory.createHandlers(validator('query', (value, c) => {
        const parsed = ApiLeaguesQuerySchema.safeParse(value);
        if (!parsed.success) return c.json({ error: "Invalid query params", details: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        try {
            const params = c.req.valid('query');
            const result = await this.sportsLogic.fetchLeagues(params);
            return c.json({ data: result, count: result.length });
        } catch (error: any) {
            console.error("Error fetching leagues from API-Sports:", error);
            return c.json({ error: "Failed to fetch leagues from API-Sports" }, 500);
        }
    });

    /**
     * GET /football/teams - Fetch teams from API-Sports
     * Query: ?league=39&season=2024&search=manches&country=england
     */
    readonly fetchTeams = this.factory.createHandlers(validator('query', (value, c) => {
        const parsed = ApiTeamsQuerySchema.safeParse(value);
        if (!parsed.success) return c.json({ error: "Invalid query params", details: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        try {
            const params = c.req.valid('query');
            const result = await this.sportsLogic.fetchTeams(params);
            return c.json({ data: result, count: result.length });
        } catch (error: any) {
            console.error("Error fetching teams from API-Sports:", error);
            return c.json({ error: "Failed to fetch teams from API-Sports" }, 500);
        }
    });

    /**
     * GET /football/fixtures - Fetch fixtures from API-Sports
     * Query: ?league=39&date=2026-02-11&team=33&season=2024&live=all&from=&to=&next=10&last=10
     */
    readonly fetchFixtures = this.factory.createHandlers(validator('query', (value, c) => {
        const parsed = ApiFixturesQuerySchema.safeParse(value);
        if (!parsed.success) return c.json({ error: "Invalid query params", details: parsed.error }, 400);
        return parsed.data;
    }), async (c) => {
        try {
            const params = c.req.valid('query');
            const result = await this.sportsLogic.fetchFixtures(params);
            return c.json({ data: result, count: result.length });
        } catch (error: any) {
            console.error("Error fetching fixtures from API-Sports:", error);
            return c.json({ error: "Failed to fetch fixtures from API-Sports" }, 500);
        }
    });
}

export default SportsController;