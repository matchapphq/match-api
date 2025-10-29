import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { VenueManagementService } from "../services/venue-management.service";
import z from "zod";

const CreateVenueSchema = z.object({
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
    address: z.string(),
    capacity: z.number().int().positive(),
    broadcasting: z.array(z.string())
});

const UpdateVenueSchema = z.object({
    name: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional(),
    capacity: z.number().int().positive().optional(),
    broadcasting: z.array(z.string()).optional()
});

class VenuesController {
    private readonly factory = createFactory();
    private readonly venueService: VenueManagementService;

    constructor() {
        this.venueService = new VenueManagementService();
    }

    // Get venues nearby (with optional lat/lng query params)
    readonly getVenues = this.factory.createHandlers(async (ctx) => {
        const lat = ctx.req.query("lat");
        const lng = ctx.req.query("lng");

        // If lat/lng provided, find nearby venues
        if (lat && lng) {
            const latNum = parseFloat(lat);
            const lngNum = parseFloat(lng);
            const radius = parseInt(ctx.req.query("radius_m") ?? "2000");
            
            if (isNaN(latNum) || isNaN(lngNum)) {
                return ctx.json({ error: "Invalid lat or lng" }, 400);
            }

            const list = this.venueService.findNearbyVenues(latNum, lngNum, radius).map(v => ({
                id: v.id,
                name: v.name,
                lat: v.lat,
                lng: v.lng,
                address: v.address,
                broadcasting: v.broadcasting,
                capacity: v.capacity
            }));

            return ctx.json(list);
        }

        // Otherwise return all venues
        const venues = this.venueService.getAllVenues();
        return ctx.json(venues);
    });

    // Get a specific venue by ID
    readonly getVenue = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("id");
        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        const venue = this.venueService.getVenueById(venueId);
        if (!venue) {
            return ctx.json({ error: "Venue not found" }, 404);
        }

        return ctx.json(venue);
    });

    // Create a new venue
    readonly createVenue = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const parsed = CreateVenueSchema.safeParse(value);
            if (!parsed.success) {
                return ctx.json({ error: "Invalid request body", details: parsed.error }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            const body = ctx.req.valid("json");
            const venue = this.venueService.createVenue(body);
            return ctx.json(venue, 201);
        }
    );

    // Update venue details
    readonly updateVenue = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const parsed = UpdateVenueSchema.safeParse(value);
            if (!parsed.success) {
                return ctx.json({ error: "Invalid request body", details: parsed.error }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            const venueId = ctx.req.param("id");
            if (!venueId) {
                return ctx.json({ error: "Venue ID required" }, 400);
            }

            const body = ctx.req.valid("json");
            const venue = this.venueService.updateVenue(venueId, body);
            
            if (!venue) {
                return ctx.json({ error: "Venue not found" }, 404);
            }

            return ctx.json(venue);
        }
    );

    // Delete a venue
    readonly deleteVenue = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("id");
        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        const deleted = this.venueService.deleteVenue(venueId);
        if (!deleted) {
            return ctx.json({ error: "Venue not found" }, 404);
        }

        return ctx.json({ message: "Venue deleted successfully" });
    });

    // Update venue capacity
    readonly updateCapacity = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("id");
        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        const body = await ctx.req.json();
        const { capacity } = body;

        if (!Number.isInteger(capacity) || capacity <= 0) {
            return ctx.json({ error: "Invalid capacity" }, 400);
        }

        const updated = this.venueService.updateVenueCapacity(venueId, capacity);
        if (!updated) {
            return ctx.json({ error: "Venue not found" }, 404);
        }

        return ctx.json({ message: "Capacity updated successfully" });
    });

    // Update what's being broadcasted
    readonly updateBroadcasting = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("id");
        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        const body = await ctx.req.json();
        const { broadcasting } = body;

        if (!Array.isArray(broadcasting) || !broadcasting.every(item => typeof item === "string")) {
            return ctx.json({ error: "Invalid broadcasting array" }, 400);
        }

        const updated = this.venueService.updateBroadcasting(venueId, broadcasting);
        if (!updated) {
            return ctx.json({ error: "Venue not found" }, 404);
        }

        return ctx.json({ message: "Broadcasting updated successfully" });
    });

    // Get available seats for a venue at a specific time
    readonly getAvailability = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("id");
        const time = ctx.req.query("time");

        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        if (!time) {
            return ctx.json({ error: "Time query parameter required" }, 400);
        }

        const available = this.venueService.getAvailableSeats(venueId, time);
        if (available === undefined) {
            return ctx.json({ error: "Venue not found" }, 404);
        }

        return ctx.json({ venueId, time, availableSeats: available });
    });
}

export default VenuesController;
