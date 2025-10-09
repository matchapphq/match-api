import { Hono } from "hono";
import BookingsController from "../controllers/booking.controller";

class BookingService {
    protected readonly router = new Hono();
    private readonly controllers = new BookingsController();

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.post("/", ...this.controllers.createBooking);
        this.router.get("/", ...this.controllers.getAll);
        this.router.get("/:id", ...this.controllers.getById);
        this.router.put("/:id", ...this.controllers.updateBooking);
        this.router.delete("/:id", ...this.controllers.deleteBooking);
    }

    get getRouter() {
        return this.router;
    }
}

export default BookingService;