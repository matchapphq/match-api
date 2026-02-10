import { Hono } from "hono";
import SportsController from "./sports.controller";
import { SportsLogic } from "./sports.logic";
import { SportsRepository } from "../../repository/sports.repository";

/**
 * Service for defining Sports, Leagues, and Teams routes (Router/Module layer).
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
        // Sports
        this.router.get("/", ...this.controller.getSports);
        this.router.get("/fixture", ...this.controller.getFixtures);
        this.router.get("/:sportId", ...this.controller.getSportById);
        this.router.get("/:sportId/leagues", ...this.controller.getLeaguesBySport);
        
        // Teams (Moved from TeamsService)
        // Note: The path prefix depends on how this router is mounted.
        // If mounted at /sports, these are /sports/teams/:teamId
        // If we want /teams/:teamId at root, we need to export multiple routers or mount differently in server.ts
        // The original server.ts mounted:
        // app.route("/sports", sportsRouter.getRouter);
        // app.route("/leagues", leaguesRouter.getRouter);
        // app.route("/teams", teamsRouter.getRouter) -> Wait, TeamsService was not mounted in server.ts in the previous read!
        // Let's check server.ts content again from previous turn.
        // "app.route("/matches", matchesRouter.getRouter);"
        // "app.route("/sports", sportsRouter.getRouter);"
        // "app.route("/leagues", leaguesRouter.getRouter);"
        // There was no teams router mounted in the main server.ts file I read. 
        // But TeamsService existed.
        // I will assume I should expose them. 
        // Since I'm merging everything into SportsService, if I mount it at /sports, I get:
        // /sports/teams/:teamId
        // /sports/leagues/:leagueId
        // This is a bit different from /leagues/:leagueId.
        
        // To maintain backward compatibility with /leagues/:leagueId, I should probably keep separate routers OR
        // I can export a router that handles all if I mount it at root `/api/`.
        // BUT, Hono `app.route("/sports", ...)` prefixes everything.
        
        // Strategy: 
        // I will keep the logical separation in this file but I might need to mount this service at `/` (root of api) 
        // and define full paths inside, OR keep it mounted at `/sports` and accept the path change, 
        // OR (best for refactor) export multiple routers or instantiate this service multiple times with different prefixes? No.
        
        // I will define routes relative to the root if I mount at `/`.
        // BUT `server.ts` mounts `sportsRouter` at `/sports`.
        
        // I will stick to the "Sports" domain. 
        // If I want to keep `/leagues` at the top level, I should probably NOT merge them into `SportsService` routes 
        // UNLESS `SportsService` is mounted at `/`.
        
        // Let's look at `server.ts` again.
        // `app.route("/sports", sportsRouter.getRouter);`
        // `app.route("/leagues", leaguesRouter.getRouter);`
        
        // If I delete `LeaguesService` and put its routes into `SportsService`, I have to mount `SportsService` differently 
        // or add `/leagues` routes inside `SportsService` and mount `SportsService` at `/`.
        
        // I will modify `initRoutes` to assume it's mounted at `/` (API root) or I will have to split them.
        // The prompt asked for modularity. `Sports` module containing `Sports`, `Leagues`, `Teams` makes sense.
        // I will define the routes with their full prefixes here and mount this service at `/` in server.ts (or `/api` in server.ts context).
        // Wait, `server.ts` does `app.basePath("/api")`.
        // So if I mount `SportsService` at `/`, it effectively handles `/api/*`.
        
        // Let's define the routes:
        this.router.get("/sports", ...this.controller.getSports);
        this.router.get("/sports/fixture", ...this.controller.getFixtures);
        this.router.get("/sports/:sportId", ...this.controller.getSportById);
        this.router.get("/sports/:sportId/leagues", ...this.controller.getLeaguesBySport);
        
        this.router.get("/leagues/:leagueId", ...this.controller.getLeagueById);
        this.router.get("/leagues/:leagueId/teams", ...this.controller.getTeamsByLeague);
        
        this.router.get("/teams/:teamId", ...this.controller.getTeamById);
    }
}

export default SportsService;