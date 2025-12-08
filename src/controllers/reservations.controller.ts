import { createFactory } from "hono/factory";

/**
 * Controller for Reservation operations.
 * Handles creating, listing, cancelling, and updating reservations, as well as check-ins.
 */
class ReservationsController {
    private readonly factory = createFactory();

    readonly createReservation = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Reservation created" });
    });

    readonly getReservations = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "List reservations" });
    });

    readonly getReservationDetails = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Reservation details" });
    });

    readonly updateReservation = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Reservation updated" });
    });

    readonly cancelReservation = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Reservation cancelled" });
    });

    readonly checkIn = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Check-in successful" });
    });
}

export default ReservationsController;
