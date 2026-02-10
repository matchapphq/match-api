import { Hono } from "hono";
import CouponsController from "./coupons.controller";
import { CouponsLogic } from "./coupons.logic";

/**
 * Service for defining Coupons routes.
 */
class CouponsService {
    private readonly router = new Hono();
    private readonly controller: CouponsController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const couponsLogic = new CouponsLogic();
        this.controller = new CouponsController(couponsLogic);
        this.initRoutes();
    }

    private initRoutes() {
        this.router.get("/validate", ...this.controller.validateCoupon);
    }
}

export default CouponsService;