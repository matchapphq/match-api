import { createFactory } from "hono/factory";
import { db } from "../../config/config.db";
import { sportsTable, leaguesTable, teamsTable } from "../../config/db/sports.table";
import { eq } from "drizzle-orm";

/**
 * Controller for Sports operations.
 * Handles fetching sports, leagues, and teams.
 */
class SportsController {
    private readonly factory = createFactory();

    /**
     * GET /sports - List all sports
     */
    readonly getSports = this.factory.createHandlers(async (c) => {
        try {
            const sports = await db.query.sportsTable.findMany({
                with: {
                    leagues: true,
                },
            });

            return c.json({ 
                data: sports,
                count: sports.length
            });
        } catch (error: any) {
            console.error("Error fetching sports:", error);
            return c.json({ error: "Failed to fetch sports" }, 500);
        }
    });

    /**
     * GET /sports/:sportId/leagues - Get leagues for a sport
     */
    readonly getLeagues = this.factory.createHandlers(async (c) => {
        try {
            const sportId = c.req.param("sportId");
            if (!sportId) return c.json({ error: "Sport ID required" }, 400);

            const leagues = await db.query.leaguesTable.findMany({
                where: eq(leaguesTable.sport_id, sportId),
            });

            return c.json({ 
                data: leagues,
                count: leagues.length
            });
        } catch (error: any) {
            console.error("Error fetching leagues:", error);
            return c.json({ error: "Failed to fetch leagues" }, 500);
        }
    });

    /**
     * GET /leagues/:leagueId/teams - Get teams for a league
     */
    readonly getTeams = this.factory.createHandlers(async (c) => {
        try {
            const leagueId = c.req.param("leagueId");
            if (!leagueId) return c.json({ error: "League ID required" }, 400);

            const teams = await db.query.teamsTable.findMany({
                where: eq(teamsTable.league_id, leagueId),
                with: {
                    league: true,
                },
            });

            return c.json({ 
                data: teams,
                count: teams.length
            });
        } catch (error: any) {
            console.error("Error fetching teams:", error);
            return c.json({ error: "Failed to fetch teams" }, 500);
        }
    });
}

export default SportsController;
