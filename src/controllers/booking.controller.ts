import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { BookingRequestSchema, type BookingRequestSchemaType } from "../utils/booking.valid";
import { BookingLogicService } from "../services/booking-logic.service";

class BookingsController {
    private readonly factory = createFactory();
    private readonly bookingLogicService: BookingLogicService;

    constructor() {
        this.bookingLogicService = new BookingLogicService();
    }

    readonly createBooking = this.factory.createHandlers(validator("json", (value, ctx) => {
        const parsed = BookingRequestSchema.safeParse(value);
        if (!parsed.success || (parsed.data.seats <= 0 || !Number.isInteger(parsed.data.seats))) {
            return ctx.json({error: "Invalid request body", details: parsed.error}, 401);
        }
        return parsed.data;
    }), async (ctx) => {
        const venueId = ctx. req.param("id");
        const body: BookingRequestSchemaType = ctx.req.valid("json");

        const { name, seats, time } = body;
        if (typeof name !== "string" || !Number.isInteger(seats) || seats <= 0 || typeof time !== "string") {
            return ctx.json({ error: "invalid payload" }, 400)
        }

        try {
            const result = await this.bookingLogicService.reserveSeats(venueId as string, name, seats, time);
            if (!result.ok) return ctx.json({ error: "not_enough_seats", available: result.available }, 409)
            return ctx.json(result.reservation, 201)
        } catch (e) {
            return ctx.json({ error: (e as Error).message }, 500)
        }
    });

    readonly getAll = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "All users bookings" })
    })

    readonly getById = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get booking by id" })
    })

    readonly updateBooking = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Update booking" })
    })

    readonly deleteBooking = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Delete booking" })
    })
}

export default BookingsController;