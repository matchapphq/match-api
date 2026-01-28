import { Hono } from "hono";
import HealthController from "../../controllers/health/health.controller";


class HealthService {
    private readonly router = new Hono();
    protected readonly healthController = new HealthController();
    
    public get getRouter() {
        return this.router;
    }
    
    constructor() {
        this.initRoutes();
    }
    
    protected initRoutes() {
        this.router.get("/", ...this.healthController.health);
        this.router.get("/test", ...this.healthController.test);
    }
}

export default HealthService;