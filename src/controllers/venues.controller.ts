import { createFactory } from "hono/factory";
import { BookingLogicService } from "../services/booking-logic.service";

class VenuesController {
    private readonly bookingLogicService: BookingLogicService;

    constructor() {
        this.bookingLogicService = new BookingLogicService();
    }

    readonly getVenues = createFactory().createHandlers(async (ctx) => {
        const lat = parseFloat(ctx.req.query("lat") ?? "")
        const lng = parseFloat(ctx.req.query("lng") ?? "")
        const radius = parseInt(ctx.req.query("radius_m") ?? "2000")
        if (isNaN(lat) || isNaN(lng)) return ctx.json({ error: "lat & lng required" }, 400)

        const list = this.bookingLogicService.findNearbyVenues(lat, lng, radius).map(v => ({
            id: v.id,
            name: v.name,
            lat: v.lat,
            lng: v.lng,
            address: v.address,
            broadcasting: v.broadcasting,
            capacity: v.capacity
        }))

        return ctx.json(list)
    });

    readonly getVenue = createFactory().createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get venue" });
    });

    readonly reserveVenue = createFactory().createHandlers(async (ctx) => {
        const venueId = ctx.req.param("id")
        const body = await ctx.req.json()
        const { name, seats, time } = body
        if (typeof name !== "string" || !Number.isInteger(seats) || seats <= 0 || typeof time !== "string") {
            return ctx.json({ error: "invalid payload" }, 400)
        }

        try {
            const result = await this.bookingLogicService.reserveSeats(venueId as string, name, seats, time)
            if (!result.ok) return ctx.json({ error: "not_enough_seats", available: result.available }, 409)
            return ctx.json(result.reservation, 201)
        } catch (e) {
            return ctx.json({ error: (e as Error).message }, 500)
        }
    });
}

export default VenuesController;
