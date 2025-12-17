import { createFactory } from "hono/factory";

/**
 * Controller for Venue operations (Read-Only/User Facing).
 * Handles fetching simple venue details, photos, reviews, and availability.
 */
import { VenueRepository } from "../../repository/venue.repository";
import { CreateVenueSchema, UpdateVenueSchema, GetVenuesSchema } from "../../utils/venue.valid";
import { db } from "../../config/config.db";
import { subscriptionsTable } from "../../config/db/subscriptions.table";
import { eq, and, gt } from "drizzle-orm";
import { validator } from "hono/validator";
import { getCookie } from "hono/cookie";
import { JwtUtils } from "../../utils/jwt";
import type { HonoEnv } from "../../types/hono.types";
import type { Context } from "hono";

/**
 * Controller for Venue operations.
 * Handles CRUD for venues with ownership and subscription checks.
 */
class VenueController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly venueRepository = new VenueRepository();

    // Helper to get user ID from context (assuming auth middleware sets it)
    private getUserId(ctx: Context<HonoEnv>): string {
        const user = ctx.get('user');
        if (!user || !user.id) {
            throw new Error("Unauthorized");
        }
        return user.id;
    }

    // Helper to check active subscription
    private async getActiveSubscription(userId: string) {
        // Find subscription for user where status is active/trialing and end_date > now
        const sub = await db.query.subscriptionsTable.findFirst({
            where: and(
                eq(subscriptionsTable.user_id, userId),
                // check status (active or trialing)
                gt(subscriptionsTable.current_period_end, new Date())
            )
        });

        if (!sub || (sub.status !== 'active' && sub.status !== 'trialing')) {
            return null;
        }
        return sub;
    }

    readonly getAll = this.factory.createHandlers(validator('query', (value, ctx) => {
        const parsed = GetVenuesSchema.safeParse(value);
        if (!parsed.success) {
            return ctx.json({ error: "Invalid query params", details: parsed.error }, 400);
        }
        return parsed.data;
    }), async (ctx) => {
        try {
            const query = ctx.req.valid('query');
            const result = await this.venueRepository.findAll(query);
            return ctx.json(result);
        } catch (error) {
            console.error("Get venues error:", error);
            return ctx.json({ error: "Failed to fetch venues" }, 500);
        }
    });

    readonly create = this.factory.createHandlers(validator('json', (value, ctx) => {
        const parsed = CreateVenueSchema.safeParse(value);
        if (!parsed.success) {
            return ctx.json({ error: "Invalid request body", details: parsed.error }, 400);
        }
        return parsed.data;
    }), async (ctx) => {
        try {
            const user = ctx.get('user');
            const body = ctx.req.valid('json');

            if (!user || !user.id) {
                return ctx.json({ error: "User ID not found (Unauthorized)" }, 401);
            }
            const userId = user.id;
            // 1. Check Subscription
            const subscription = await this.getActiveSubscription(userId);
            if (!subscription) {
                return ctx.json({ error: "Active subscription required to create a venue." }, 403);
            }

            // 2. Create Venue
            const venue = await this.venueRepository.create(userId, subscription.id, body);

            return ctx.json(venue, 201);
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Create venue error:", error);
            return ctx.json({ error: "Failed to create venue" }, 500);
        }
    });

    readonly update = this.factory.createHandlers(validator('json', (value, ctx) => {
        const parsed = UpdateVenueSchema.safeParse(value);
        if (!parsed.success) {
            return ctx.json({ error: "Invalid request body", details: parsed.error }, 400);
        }
        return parsed.data;
    }), async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const venueId = ctx.req.param("venueId");

            if (!venueId) {
                return ctx.json({ error: "Venue ID is required" }, 400);
            }

            const body = ctx.req.valid('json');

            // 1. Verify Ownership & Existence using findByOwnerId logic or direct check
            // We can fetch the venue first
            const existing = await this.venueRepository.findById(venueId);
            if (!existing) {
                return ctx.json({ error: "Venue not found" }, 404);
            }
            if (existing.owner_id !== userId) {
                return ctx.json({ error: "Forbidden" }, 403);
            }

            // 2. Update
            const updated = await this.venueRepository.update(venueId, body);
            return ctx.json(updated);
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Update venue error:", error);
            return ctx.json({ error: "Failed to update venue" }, 500);
        }
    });

    readonly delete = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const venueId = ctx.req.param("venueId");

            if (!venueId) {
                return ctx.json({ error: "Venue ID is required" }, 400);
            }

            const existing = await this.venueRepository.findById(venueId);
            if (!existing) {
                return ctx.json({ error: "Venue not found" }, 404);
            }
            if (existing.owner_id !== userId) {
                return ctx.json({ error: "Forbidden" }, 403);
            }

            await this.venueRepository.softDelete(venueId);
            return ctx.json({ message: "Venue deleted successfully" });

        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Delete venue error:", error);
            return ctx.json({ error: "Failed to delete venue" }, 500);
        }
    });

    readonly getDetails = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");

        if (!venueId) {
            return ctx.json({ error: "Venue ID is required" }, 400);
        }

        const venue = await this.venueRepository.findById(venueId);

        if (!venue) {
            return ctx.json({ error: "Venue not found" }, 404);
        }

        // Logic to return stats if needed (currently included in venue object from DB if joined, or we can fetch separately)
        // For now, returning the venue object which matches schemas.
        // PostGIS 'location' field might need serialization if it comes back as binary.
        // Drizzle might return it as object or string depending on driver setup.
        // We know we explicitly set lat/lng columns on create/update so those should be correct for the client.

        return ctx.json(venue);
    });

    readonly getPhotos = this.factory.createHandlers(async (ctx) => {
        // TODO: Implement actual photo fetch if separate from details
        return ctx.json({ msg: "Venue photos" });
    });

    readonly getReviews = this.factory.createHandlers(async (ctx) => {
        // TODO: Implement
        return ctx.json({ msg: "Venue reviews" });
    });

    readonly getMatches = this.factory.createHandlers(async (ctx) => {
        // TODO: Implement
        return ctx.json({ msg: "Venue matches" });
    });

    readonly getAvailability = this.factory.createHandlers(async (ctx) => {
        // TODO: Implement
        return ctx.json({ msg: "Venue availability" });
    });
}

export default VenueController;
