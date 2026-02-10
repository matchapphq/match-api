import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import FidelityController from "./fidelity.controller";
import { FidelityLogic } from "./fidelity.logic";

class FidelityService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller: FidelityController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const fidelityLogic = new FidelityLogic();
        this.controller = new FidelityController(fidelityLogic);
        this.initRoutes();
    }

    private initRoutes() {
        // GET /api/fidelity/summary - Get user's fidelity summary
        this.router.get("/summary", ...this.controller.getSummary);

        // GET /api/fidelity/points-history - Get user's points transaction history
        this.router.get("/points-history", ...this.controller.getPointsHistory);

        // GET /api/fidelity/badges - Get user's badges (unlocked and locked)
        this.router.get("/badges", ...this.controller.getBadges);

        // GET /api/fidelity/challenges - Get user's challenges
        this.router.get("/challenges", ...this.controller.getChallenges);

        // GET /api/fidelity/levels - Get all available levels
        this.router.get("/levels", ...this.controller.getLevels);
    }
}

// Export a singleton instance's router to match previous export style if needed, 
// OR export the service class. 
// Given server.ts uses `fidelityService` directly as a router (it was exporting `fidelityService` as Hono instance),
// I need to check how `server.ts` imports it.
// server.ts: `import fidelityService from "./services/fidelity/fidelity.service";`
// and usage: `app.route("/fidelity", fidelityService);`
// So it expects an object with `.fetch` or similar, usually a Hono instance.
// But my new pattern exports a class with `getRouter`.
// I will export an INSTANCE of the class for now, or just the router property to minimize server.ts changes?
// Actually, I am changing server.ts anyway. 
// I will export the class as default and instantiate it in server.ts.

export default FidelityService;