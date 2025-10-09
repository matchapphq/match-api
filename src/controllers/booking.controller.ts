import { createFactory } from "hono/factory";

class BookingsController {
    private readonly factory = createFactory();

    readonly createBooking = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Create booking" });
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