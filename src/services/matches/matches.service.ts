import { Hono } from "hono";
import MatchesController from "../../controllers/matches/matches.controller";

/**
 * Service for defining Matches routes.
 * Mounts the MatchesController handlers to the router.
 */
class MatchesService {
    private readonly router = new Hono();
    private readonly controller = new MatchesController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        this.router.get("/", ...this.controller.getMatches);
        this.router.get("/upcoming", ...this.controller.getUpcoming);
        this.router.get("/upcoming-nearby", ...this.controller.getUpcomingNearby);
        this.router.get("/:matchId", ...this.controller.getMatchDetails);
        this.router.get("/:matchId/venues", ...this.controller.getMatchVenues);
        this.router.get("/:matchId/live-updates", ...this.controller.getLiveUpdates);

        // Sports route might need to be at root or under matches/sports? 
        // Plan said GET /sports, but here attaching to /matches service means /matches/sports if not careful.
        // If we want /sports, we should probably mount it separately in server.ts or handle here if the prefix matches.
        // For now, let's assume /matches/sports or similar, but the plan said /sports.
        // If strictly /sports, we'd need a separate service or mapping.
        // Let's check server.ts later. For now, putting it here as /matches/sports logic or separate?
        // Wait, the plan lists it under Matches Routes section but the path is /sports.
        // I will add a separate service for Sports if needed, or just put it here for now and we can remap in server.ts
        // Actually, if I mount this service to "/matches", then "/sports" won't work here.
        // I will keep getSports here but I might need to mount a separate route for it in server.ts or handling it differently.
        // Let's create a separate route/service for sports or just include it?
        // I'll keep it in controller but maybe specific route in server.ts?
        // Let's just create a separate SportsController/Service if it's cleaner, or just add it to MatchesService and I will handle the mount point in server.ts
        // For now, I will add it to the controller.
    }
}

export default MatchesService;
