import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import type { Context } from "hono";

import { VenueRepository } from "../../repository/venue.repository";
import { FavoritesRepository } from "../../repository/favorites.repository";
import {
    CreateVenueSchema,
    UpdateVenueSchema,
    GetVenuesSchema,
} from "../../utils/venue.valid";
import { db } from "../../config/config.db";
import { subscriptionsTable } from "../../config/db/subscriptions.table";
import type { HonoEnv } from "../../types/hono.types";

/**
 * Controller for Venue operations.
 * Handles CRUD for venues with ownership and subscription checks.
 */
// Validation schemas for favorites
const AddFavoriteSchema = z.object({
    note: z.string().max(500).optional(),
});

const UpdateFavoriteNoteSchema = z.object({
    note: z.string().max(500).nullable(),
});

class VenueController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly venueRepository = new VenueRepository();
    private readonly favoritesRepository = new FavoritesRepository();

    // Helper to get user ID from context (assuming auth middleware sets it)
    private getUserId(ctx: Context<HonoEnv>): string {
        const user = ctx.get("user");
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
                gt(subscriptionsTable.current_period_end, new Date()),
            ),
        });

        if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
            return null;
        }
        return sub;
    }

    readonly getAll = this.factory.createHandlers(
        validator("query", (value, ctx) => {
            const parsed = GetVenuesSchema.safeParse(value);
            if (!parsed.success) {
                return ctx.json(
                    { error: "Invalid query params", details: parsed.error },
                    400,
                );
            }
            return parsed.data;
        }),
        async (ctx) => {
            try {
                const query = ctx.req.valid("query");
                const result = await this.venueRepository.findAll(query);
                return ctx.json(result);
            } catch (error) {
                console.error("Get venues error:", error);
                return ctx.json({ error: "Failed to fetch venues" }, 500);
            }
        },
    );

    readonly getNearby = this.factory.createHandlers(async (ctx) => {
        try {
            const { lat, lng, radius = "5000" } = ctx.req.query();

            if (!lat || !lng) {
                return ctx.json(
                    { error: "lat and lng query parameters are required" },
                    400,
                );
            }

            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            const radiusKm = parseInt(radius) / 1000; // Convert meters to km

            // Get all venues and filter by distance (simple implementation)
            const result = await this.venueRepository.findAll({});
            
            // Filter venues by distance using Haversine formula
            const nearbyVenues = result.data.filter((venue: any) => {
                    if (!venue.latitude || !venue.longitude) return false;
                    const distance = this.calculateDistance(
                        latitude,
                        longitude,
                        venue.latitude,
                        venue.longitude,
                    );
                    return distance <= radiusKm;
                }).map((venue: any) => ({
                    ...venue,
                    distance: this.calculateDistance(
                        latitude,
                        longitude,
                        venue.latitude,
                        venue.longitude,
                    ).toFixed(2),
                }))
                .sort(
                    (a: any, b: any) =>
                        parseFloat(a.distance) - parseFloat(b.distance),
                );
            return ctx.json(nearbyVenues);
        } catch (error) {
            console.error("Get nearby venues error:", error);
            return ctx.json({ error: "Failed to fetch nearby venues" }, 500);
        }
    });

    // Haversine formula to calculate distance between two points
    private calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ): number {
        const R = 6371; // Radius of Earth in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    readonly create = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const parsed = CreateVenueSchema.safeParse(value);
            if (!parsed.success) {
                return ctx.json(
                    { error: "Invalid request body", details: parsed.error },
                    400,
                );
            }
            return parsed.data;
        }),
        async (ctx) => {
            try {
                const user = ctx.get("user");
                const body = ctx.req.valid("json");

                if (!user || !user.id) {
                    return ctx.json(
                        { error: "User ID not found (Unauthorized)" },
                        401,
                    );
                }
                const userId = user.id;
                // 1. Check Subscription
                const subscription = await this.getActiveSubscription(userId);
                if (!subscription) {
                    return ctx.json(
                        {
                            error: "Active subscription required to create a venue.",
                        },
                        403,
                    );
                }

                // 2. Create Venue
                const venue = await this.venueRepository.create(
                    userId,
                    subscription.id,
                    body,
                );

                return ctx.json(venue, 201);
            } catch (error: any) {
                if (error.message === "Unauthorized")
                    return ctx.json({ error: "Unauthorized" }, 401);
                console.error("Create venue error:", error);
                return ctx.json({ error: "Failed to create venue" }, 500);
            }
        },
    );

    readonly update = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const parsed = UpdateVenueSchema.safeParse(value);
            if (!parsed.success) {
                return ctx.json(
                    { error: "Invalid request body", details: parsed.error },
                    400,
                );
            }
            return parsed.data;
        }),
        async (ctx) => {
            try {
                const userId = this.getUserId(ctx);
                const venueId = ctx.req.param("venueId");

                if (!venueId) {
                    return ctx.json({ error: "Venue ID is required" }, 400);
                }

                const body = ctx.req.valid("json");

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
                const updated = await this.venueRepository.update(
                    venueId,
                    body,
                );
                return ctx.json(updated);
            } catch (error: any) {
                if (error.message === "Unauthorized")
                    return ctx.json({ error: "Unauthorized" }, 401);
                console.error("Update venue error:", error);
                return ctx.json({ error: "Failed to update venue" }, 500);
            }
        },
    );

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
            if (error.message === "Unauthorized")
                return ctx.json({ error: "Unauthorized" }, 401);
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

    /**
     * PUT /venues/:venueId/booking-mode - Update venue booking mode (owner only)
     */
    readonly updateBookingMode = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const schema = z.object({
                booking_mode: z.enum(["INSTANT", "REQUEST"]),
            });
            const parsed = schema.safeParse(value);
            if (!parsed.success) {
                return ctx.json(
                    { error: "Invalid request body", details: parsed.error },
                    400,
                );
            }
            return parsed.data;
        }),
        async (ctx) => {
            try {
                const userId = this.getUserId(ctx);
                const venueId = ctx.req.param("venueId");

                if (!venueId) {
                    return ctx.json({ error: "Venue ID is required" }, 400);
                }

                const { booking_mode } = ctx.req.valid("json");

                // Verify ownership
                const existing = await this.venueRepository.findById(venueId);
                if (!existing) {
                    return ctx.json({ error: "Venue not found" }, 404);
                }
                if (existing.owner_id !== userId) {
                    return ctx.json({ error: "Forbidden" }, 403);
                }

                // Update booking mode
                const updated = await this.venueRepository.update(venueId, {
                    booking_mode,
                });

                return ctx.json({ venue: updated });
            } catch (error: any) {
                if (error.message === "Unauthorized")
                    return ctx.json({ error: "Unauthorized" }, 401);
                console.error("Update booking mode error:", error);
                return ctx.json({ error: "Failed to update booking mode" }, 500);
            }
        },
    );

    // =============================================
    // FAVORITES ENDPOINTS
    // =============================================

    /**
     * POST /venues/:venueId/favorite - Add venue to favorites
     */
    readonly addFavorite = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const parsed = AddFavoriteSchema.safeParse(value);
            if (!parsed.success) {
                return ctx.json(
                    { error: "Invalid request body", details: parsed.error },
                    400,
                );
            }
            return parsed.data;
        }),
        async (ctx) => {
            try {
                const userId = this.getUserId(ctx);
                const venueId = ctx.req.param("venueId");

                if (!venueId) {
                    return ctx.json({ error: "Venue ID is required" }, 400);
                }

                const { note } = ctx.req.valid("json");

                const result = await this.favoritesRepository.addFavorite(
                    userId,
                    venueId,
                    note,
                );

                if (!result.success) {
                    if (result.error === "venue_not_found") {
                        return ctx.json({ error: "Venue not found" }, 404);
                    }
                    if (result.error === "already_favorited") {
                        return ctx.json(
                            { error: "Venue is already in your favorites" },
                            409,
                        );
                    }
                    return ctx.json({ error: "Failed to add favorite" }, 500);
                }

                return ctx.json(
                    {
                        message: result.restored
                            ? "Venue restored to favorites"
                            : "Venue added to favorites",
                        favorite: result.favorite,
                    },
                    201,
                );
            } catch (error: any) {
                if (error.message === "Unauthorized")
                    return ctx.json({ error: "Unauthorized" }, 401);
                console.error("Add favorite error:", error);
                return ctx.json({ error: "Failed to add favorite" }, 500);
            }
        },
    );

    /**
     * DELETE /venues/:venueId/favorite - Remove venue from favorites
     */
    readonly removeFavorite = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const venueId = ctx.req.param("venueId");

            if (!venueId) {
                return ctx.json({ error: "Venue ID is required" }, 400);
            }

            const deleted = await this.favoritesRepository.removeFavorite(
                userId,
                venueId,
            );

            if (!deleted) {
                return ctx.json({ error: "Favorite not found" }, 404);
            }

            return ctx.json({ message: "Venue removed from favorites" });
        } catch (error: any) {
            if (error.message === "Unauthorized")
                return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Remove favorite error:", error);
            return ctx.json({ error: "Failed to remove favorite" }, 500);
        }
    });

    /**
     * PATCH /venues/:venueId/favorite - Update note on a favorite
     */
    readonly updateFavoriteNote = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const parsed = UpdateFavoriteNoteSchema.safeParse(value);
            if (!parsed.success) {
                return ctx.json(
                    { error: "Invalid request body", details: parsed.error },
                    400,
                );
            }
            return parsed.data;
        }),
        async (ctx) => {
            try {
                const userId = this.getUserId(ctx);
                const venueId = ctx.req.param("venueId");

                if (!venueId) {
                    return ctx.json({ error: "Venue ID is required" }, 400);
                }

                const { note } = ctx.req.valid("json");

                const updated = await this.favoritesRepository.updateNote(
                    userId,
                    venueId,
                    note,
                );

                if (!updated) {
                    return ctx.json({ error: "Favorite not found" }, 404);
                }

                return ctx.json({
                    message: "Favorite note updated",
                    favorite: updated,
                });
            } catch (error: any) {
                if (error.message === "Unauthorized")
                    return ctx.json({ error: "Unauthorized" }, 401);
                console.error("Update favorite note error:", error);
                return ctx.json({ error: "Failed to update favorite" }, 500);
            }
        },
    );

    /**
     * GET /venues/:venueId/favorite - Check if venue is favorited
     */
    readonly checkFavorite = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const venueId = ctx.req.param("venueId");

            if (!venueId) {
                return ctx.json({ error: "Venue ID is required" }, 400);
            }

            const favorite = await this.favoritesRepository.getFavorite(
                userId,
                venueId,
            );

            return ctx.json({
                isFavorited: !!favorite,
                favorite: favorite ?? null,
            });
        } catch (error: any) {
            if (error.message === "Unauthorized")
                return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Check favorite error:", error);
            return ctx.json({ error: "Failed to check favorite" }, 500);
        }
    });
}

export default VenueController;
