import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { z } from "zod";
import { SportsRepository } from "../../repository/sports.repository";

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

/**
 * Controller for Sports operations.
 * Handles fetching sports, leagues, and teams.
 */
class SportsController {
    private readonly factory = createFactory();
    private readonly sportsRepo = new SportsRepository();

    // ============================================
    // SPORTS ENDPOINTS
    // ============================================

    /**
     * GET /sports - List all sports with pagination
     */
    readonly getSports = this.factory.createHandlers(validator('query', (value, c) => {
        const parsed = SportsQuerySchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid query params", details: parsed.error }, 400);
        }
        return parsed.data;
    }), async (c) => {
        try {
            const { page, limit, is_active } = c.req.valid('query');

            const result = await this.sportsRepo.findAllSports({
                page,
                limit,
                isActive: is_active
            });

            return c.json(result);
        } catch (error: any) {
            console.error("Error fetching sports:", error);
            return c.json({ error: "Failed to fetch sports" }, 500);
        }
    });

    /**
     * GET /sports/:sportId - Get sport details
     */
    readonly getSportById = this.factory.createHandlers(async (c) => {
        try {
            const sportId = c.req.param("sportId");
            if (!sportId) {
                return c.json({ error: "Sport ID required" }, 400);
            }

            const sport = await this.sportsRepo.findSportById(sportId);

            if (!sport) {
                return c.json({ error: "Sport not found" }, 404);
            }

            return c.json(sport);
        } catch (error: any) {
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
            if (!sportId) {
                return c.json({ error: "Sport ID required" }, 400);
            }

            // Verify sport exists
            const sport = await this.sportsRepo.findSportById(sportId);
            if (!sport) {
                return c.json({ error: "Sport not found" }, 404);
            }

            const { page, limit, is_active, country } = c.req.valid('query');

            const result = await this.sportsRepo.findLeaguesBySportId(sportId, {
                page,
                limit,
                isActive: is_active,
                country
            });

            return c.json(result);
        } catch (error: any) {
            console.error("Error fetching leagues:", error);
            return c.json({ error: "Failed to fetch leagues" }, 500);
        }
    });

    // ============================================
    // LEAGUES ENDPOINTS
    // ============================================

    /**
     * GET /leagues/:leagueId - Get league details
     */
    readonly getLeagueById = this.factory.createHandlers(async (c) => {
        try {
            const leagueId = c.req.param("leagueId");
            if (!leagueId) {
                return c.json({ error: "League ID required" }, 400);
            }

            const league = await this.sportsRepo.findLeagueById(leagueId);

            if (!league) {
                return c.json({ error: "League not found" }, 404);
            }

            return c.json(league);
        } catch (error: any) {
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
            if (!leagueId) {
                return c.json({ error: "League ID required" }, 400);
            }

            // Verify league exists
            const league = await this.sportsRepo.findLeagueById(leagueId);
            if (!league) {
                return c.json({ error: "League not found" }, 404);
            }

            const { page, limit, is_active } = c.req.valid('query');

            const result = await this.sportsRepo.findTeamsByLeagueId(leagueId, {
                page,
                limit,
                isActive: is_active
            });

            return c.json(result);
        } catch (error: any) {
            console.error("Error fetching teams:", error);
            return c.json({ error: "Failed to fetch teams" }, 500);
        }
    });

    // ============================================
    // TEAMS ENDPOINTS
    // ============================================

    /**
     * GET /teams/:teamId - Get team details
     */
    readonly getTeamById = this.factory.createHandlers(async (c) => {
        try {
            const teamId = c.req.param("teamId");
            if (!teamId) {
                return c.json({ error: "Team ID required" }, 400);
            }

            const team = await this.sportsRepo.findTeamById(teamId);

            if (!team) {
                return c.json({ error: "Team not found" }, 404);
            }

            return c.json(team);
        } catch (error: any) {
            console.error("Error fetching team:", error);
            return c.json({ error: "Failed to fetch team" }, 500);
        }
    });
}

export default SportsController;
