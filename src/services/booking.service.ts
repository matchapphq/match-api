import { Hono } from "hono";
import BookingsController from "../controllers/booking.controller";

class BookingService {
    protected readonly router = new Hono();
    private readonly bookingsController = new BookingsController();

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        // User booking operations
        this.router.get("/", ...this.bookingsController.getAll); // Get all bookings (or user's bookings with ?userName=)
        this.router.post("/:id", ...this.bookingsController.createBooking); // Create a booking at venue :id
        this.router.get("/:id", ...this.bookingsController.getById); // Get specific booking by ID
        this.router.put("/:id", ...this.bookingsController.updateBooking); // Update a booking
        this.router.delete("/:id", ...this.bookingsController.deleteBooking); // Cancel/delete a booking
    }

    get getRouter() {
        return this.router;
    }
}

export default BookingService;