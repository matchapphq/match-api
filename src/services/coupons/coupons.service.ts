import { Hono } from "hono";
import CouponsController from "../../controllers/coupons/coupons.controller";

/**
 * Service for defining Coupons routes.
 */
class CouponsService {
    private readonly router = new Hono();
    private readonly controller = new CouponsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        this.router.get("/validate", ...this.controller.validateCoupon);
    }
}

export default CouponsService;
