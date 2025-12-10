import { Hono } from "hono";
import OnboardingController from "../../controllers/onboarding/onboarding.controller";

/**
 * Service for defining Onboarding routes.
 * Mounts the OnboardingController handlers to the router.
 */
class OnboardingService {
    private readonly router = new Hono();
    private readonly controller = new OnboardingController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.get("/status", ...this.controller.getStatus);
        this.router.post("/preferences", ...this.controller.savePreferences);
        this.router.get("/sports", ...this.controller.getSports);
        this.router.get("/categories", ...this.controller.getCategories);
        this.router.get("/ambiances", ...this.controller.getAmbiances);
    }
}

export default OnboardingService;
