import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { BookingRequestSchema, type BookingRequestSchemaType } from "../utils/booking.valid";
import { BookingLogicService } from "../services/booking-logic.service";

class BookingsController {
    private readonly factory = createFactory();
    private readonly bookingService: BookingLogicService;

    constructor() {
        this.bookingService = new BookingLogicService();
    }

    // Create a new booking for a venue
    readonly createBooking = this.factory.createHandlers(validator("json", (value, ctx) => {
        const parsed = BookingRequestSchema.safeParse(value);
        if (!parsed.success || (parsed.data.seats <= 0 || !Number.isInteger(parsed.data.seats))) {
            return ctx.json({error: "Invalid request body", details: parsed.error}, 401);
        }
        return parsed.data;
    }), async (ctx) => {
        const venueId = ctx.req.param("id");
        const body: BookingRequestSchemaType = ctx.req.valid("json");

        const { name, seats, time } = body;
        if (typeof name !== "string" || !Number.isInteger(seats) || seats <= 0 || typeof time !== "string") {
            return ctx.json({ error: "invalid payload" }, 400)
        }

        try {
            const result = await this.bookingService.createBooking(venueId as string, name, seats, time);
            if (!result.ok) return ctx.json({ error: "not_enough_seats", available: result.available }, 409)
            return ctx.json(result.reservation, 201)
        } catch (e) {
            return ctx.json({ error: (e as Error).message }, 500)
        }
    });

    // Get all bookings for a user (query param: userName)
    readonly getAll = this.factory.createHandlers(async (ctx) => {
        const userName = ctx.req.query("userName");
        
        if (!userName) {
            // Return all bookings if no userName specified (admin view)
            const bookings = this.bookingService.getAllBookings();
            return ctx.json(bookings);
        }

        const bookings = this.bookingService.getUserBookings(userName);
        return ctx.json(bookings);
    })

    // Get a specific booking by ID
    readonly getById = this.factory.createHandlers(async (ctx) => {
        const bookingId = ctx.req.param("id");
        if (!bookingId) {
            return ctx.json({ error: "Booking ID required" }, 400);
        }
        const booking = this.bookingService.getBookingById(bookingId);
        
        if (!booking) {
            return ctx.json({ error: "Booking not found" }, 404);
        }
        
        return ctx.json(booking);
    })

    // Update a booking
    readonly updateBooking = this.factory.createHandlers(async (ctx) => {
        const bookingId = ctx.req.param("id");
        if (!bookingId) {
            return ctx.json({ error: "Booking ID required" }, 400);
        }
        const body = await ctx.req.json();
        const { seats, time } = body;

        if (!Number.isInteger(seats) || seats <= 0 || typeof time !== "string") {
            return ctx.json({ error: "invalid payload" }, 400);
        }

        try {
            const result = await this.bookingService.updateBooking(bookingId, seats, time);
            if (!result.ok) {
                return ctx.json({ error: "not_enough_seats", available: result.available }, 409);
            }
            return ctx.json(result.reservation);
        } catch (e) {
            return ctx.json({ error: (e as Error).message }, 500);
        }
    })

    // Cancel/delete a booking
    readonly deleteBooking = this.factory.createHandlers(async (ctx) => {
        const bookingId = ctx.req.param("id");
        if (!bookingId) {
            return ctx.json({ error: "Booking ID required" }, 400);
        }
        
        try {
            const deleted = await this.bookingService.deleteBooking(bookingId);
            if (!deleted) {
                return ctx.json({ error: "Booking not found" }, 404);
            }
            return ctx.json({ message: "Booking cancelled successfully" });
        } catch (e) {
            return ctx.json({ error: (e as Error).message }, 500);
        }
    })
}

export default BookingsController;