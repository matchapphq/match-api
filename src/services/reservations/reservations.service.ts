import { Hono } from "hono";
import ReservationsController from "../../controllers/reservations/reservations.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";

class ReservationsService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller = new ReservationsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        // Protected routes
        this.router.use("/*", authMiddleware);

        this.router.get("/", ...this.controller.list);
        this.router.post("/hold", ...this.controller.holdTable);
        this.router.post("/confirm", ...this.controller.confirmReservation);
    }
}

export default ReservationsService;
