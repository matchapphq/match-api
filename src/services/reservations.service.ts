import { Hono } from "hono";
import ReservationsController from "../controllers/reservations.controller";

/**
 * Service for defining Reservations routes.
 * Mounts the ReservationsController handlers to the router.
 */
class ReservationsService {
    private readonly router = new Hono();
    private readonly controller = new ReservationsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.post("/", ...this.controller.createReservation);
        this.router.get("/", ...this.controller.getReservations);
        this.router.get("/:reservationId", ...this.controller.getReservationDetails);
        this.router.put("/:reservationId", ...this.controller.updateReservation);
        this.router.delete("/:reservationId", ...this.controller.cancelReservation);
        this.router.post("/:reservationId/check-in", ...this.controller.checkIn);
    }
}

export default ReservationsService;
