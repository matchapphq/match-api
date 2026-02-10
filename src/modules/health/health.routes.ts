import { Hono } from "hono";
import HealthController from "./health.controller";
import { HealthLogic } from "./health.logic";

class HealthService {
    private readonly router = new Hono();
    protected readonly healthController: HealthController;
    
    public get getRouter() {
        return this.router;
    }
    
    constructor() {
        const healthLogic = new HealthLogic();
        this.healthController = new HealthController(healthLogic);
        this.initRoutes();
    }
    
    protected initRoutes() {
        this.router.get("/", ...this.healthController.health);
        this.router.get("/test", ...this.healthController.test);
    }
}

export default HealthService;
