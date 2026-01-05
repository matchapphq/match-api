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
        this.router.post("/complete", ...this.controller.complete);
    }
}

export default OnboardingService;
