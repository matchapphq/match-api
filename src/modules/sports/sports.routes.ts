import { Hono } from "hono";
import SportsController from "./sports.controller";
import { SportsLogic } from "./sports.logic";
import { SportsRepository } from "../../repository/sports.repository";

/**
 * Service for defining Sports, Leagues, and Teams routes (Router/Module layer).
 * 
 * Mounted at "/" in server.ts so routes are:
 *   DB-backed:   /sports, /sports/:sportId, /leagues/:leagueId, /teams/:teamId
 *   API-Sports:  /football/countries, /football/leagues, /football/teams, /football/fixtures
 */
class SportsService {
    private readonly router = new Hono();
    private readonly controller: SportsController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const sportsRepo = new SportsRepository();
        const sportsLogic = new SportsLogic(sportsRepo);
        this.controller = new SportsController(sportsLogic);
        this.initRoutes();
    }

    private initRoutes(): void {
        // --- DB-backed routes (existing, backward compat) ---
        this.router.get("/sports", ...this.controller.getSports);
        this.router.get("/sports/fixture", ...this.controller.getFixtures);
        this.router.get("/sports/:sportId", ...this.controller.getSportById);
        this.router.get("/sports/:sportId/leagues", ...this.controller.getLeaguesBySport);
        
        this.router.get("/leagues/:leagueId", ...this.controller.getLeagueById);
        this.router.get("/leagues/:leagueId/teams", ...this.controller.getTeamsByLeague);
        
        this.router.get("/teams/:teamId", ...this.controller.getTeamById);

        // --- API-Sports live data routes (real football data) ---
        this.router.get("/football/countries", ...this.controller.fetchCountries);
        this.router.get("/football/leagues", ...this.controller.fetchLeagues);
        this.router.get("/football/teams", ...this.controller.fetchTeams);
        this.router.get("/football/fixtures", ...this.controller.fetchFixtures);
    }
}

export default SportsService;