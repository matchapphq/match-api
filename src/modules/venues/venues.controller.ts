import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { z } from "zod";
import type { Context } from "hono";
import {
    CreateVenueSchema,
    UpdateVenueSchema,
    GetVenuesSchema,
} from "../../utils/venue.valid";
import type { HonoEnv } from "../../types/hono.types";
import { VenuesLogic } from "./venues.logic";

// Validation schemas for favorites
const AddFavoriteSchema = z.object({
    note: z.string().max(500).optional(),
});

const UpdateFavoriteNoteSchema = z.object({
    note: z.string().max(500).nullable(),
});

class VenueController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly venuesLogic: VenuesLogic) {}

    // Helper to get user ID from context
    private getUserId(ctx: Context<HonoEnv>): string {
        const user = ctx.get("user");
        if (!user || !user.id) {
            throw new Error("Unauthorized");
        }
        return user.id;
    }

    public readonly getAll = this.factory.createHandlers(
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
                const result = await this.venuesLogic.findAll(query);
                return ctx.json(result);
            } catch (error) {
                console.error("Get venues error:", error);
                return ctx.json({ error: "Failed to fetch venues" }, 500);
            }
        },
    );

    public readonly getNearby = this.factory.createHandlers(async (ctx) => {
        try {
            const { lat, lng, radius = "5000" } = ctx.req.query();

            if (!lat || !lng) {
                return ctx.json(
                    { error: "lat and lng query parameters are required" },
                    400,
                );
            }

            const nearbyVenues = await this.venuesLogic.getNearby(lat, lng, radius);
            return ctx.json(nearbyVenues);
        } catch (error) {
            console.error("Get nearby venues error:", error);
            return ctx.json({ error: "Failed to fetch nearby venues" }, 500);
        }
    });

    public readonly create = this.factory.createHandlers(
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
                const userId = this.getUserId(ctx);
                const body = ctx.req.valid("json");

                const venue = await this.venuesLogic.create(userId, body);
                return ctx.json(venue, 201);
            } catch (error: any) {
                if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
                if (error.message === "SUBSCRIPTION_REQUIRED") return ctx.json({ error: "Active subscription required to create a venue." }, 403);
                
                console.error("Create venue error:", error);
                return ctx.json({ error: "Failed to create venue" }, 500);
            }
        },
    );

    public readonly update = this.factory.createHandlers(
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

                if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

                const body = ctx.req.valid("json");
                const updated = await this.venuesLogic.update(userId, venueId, body);
                return ctx.json(updated);
            } catch (error: any) {
                if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
                if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
                if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);

                console.error("Update venue error:", error);
                return ctx.json({ error: "Failed to update venue" }, 500);
            }
        },
    );

    readonly delete = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const venueId = ctx.req.param("venueId");

            if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

            await this.venuesLogic.delete(userId, venueId);
            return ctx.json({ message: "Venue deleted successfully" });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);

            console.error("Delete venue error:", error);
            return ctx.json({ error: "Failed to delete venue" }, 500);
        }
    });

    readonly getDetails = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

        try {
            const user = ctx.get("user");
            const ip = ctx.req.header('x-forwarded-for') || ctx.req.header('remote-addr');
            const userAgent = ctx.req.header('user-agent');

            const venue = await this.venuesLogic.getDetails(venueId, user?.id, ip, userAgent);
            return ctx.json(venue);
        } catch (error: any) {
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            console.error("Get details error:", error);
            return ctx.json({ error: "Failed to fetch venue details" }, 500);
        }
    });

    readonly getPhotos = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

        try {
            const photos = await this.venuesLogic.getPhotos(venueId);
            return ctx.json({ photos });
        } catch (error: any) {
            console.error("Get venue photos error:", error);
            return ctx.json({ error: "Failed to fetch photos" }, 500);
        }
    });

    readonly uploadPhoto = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

        try {
            const userId = this.getUserId(ctx);
            const body = await ctx.req.json();
            if (!body.photo_url) return ctx.json({ error: "photo_url is required" }, 400);

            const photo = await this.venuesLogic.uploadPhoto(userId, venueId, body);
            return ctx.json({ photo }, 201);
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);

            console.error("Upload photo error:", error);
            return ctx.json({ error: "Failed to upload photo" }, 500);
        }
    });

    readonly deletePhoto = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        const photoId = ctx.req.param("photoId");
        if (!venueId || !photoId) return ctx.json({ error: "Venue ID and Photo ID are required" }, 400);

        try {
            const userId = this.getUserId(ctx);
            await this.venuesLogic.deletePhoto(userId, venueId, photoId);
            return ctx.json({ message: "Photo deleted successfully" });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            if (error.message === "PHOTO_NOT_FOUND") return ctx.json({ error: "Photo not found" }, 404);
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);

            console.error("Delete photo error:", error);
            return ctx.json({ error: "Failed to delete photo" }, 500);
        }
    });

    readonly getReviews = this.factory.createHandlers(async (ctx) => {
        // TODO: Implement
        return ctx.json({ msg: "Venue reviews" });
    });

    readonly getMatches = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

        try {
            const upcomingOnly = ctx.req.query("upcoming_only") !== "false";
            const matches = await this.venuesLogic.getMatches(venueId, upcomingOnly);
            return ctx.json(matches);
        } catch (error: any) {
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            console.error("Get venue matches error:", error);
            return ctx.json({ error: "Failed to fetch venue matches" }, 500);
        }
    });

    readonly getAvailability = this.factory.createHandlers(async (ctx) => {
        // TODO: Implement
        return ctx.json({ msg: "Venue availability" });
    });

    readonly getOpeningHours = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

        try {
            const openingHours = await this.venuesLogic.getOpeningHours(venueId);
            return ctx.json({ opening_hours: openingHours });
        } catch (error: any) {
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            console.error("Get opening hours error:", error);
            return ctx.json({ error: "Failed to fetch opening hours" }, 500);
        }
    });

    readonly updateOpeningHours = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

        try {
            const userId = this.getUserId(ctx);
            const body = await ctx.req.json();
            if (!body.opening_hours) return ctx.json({ error: "opening_hours is required" }, 400);

            const updated = await this.venuesLogic.updateOpeningHours(userId, venueId, body.opening_hours);
            return ctx.json({ venue: updated, message: "Opening hours updated" });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);

            console.error("Update opening hours error:", error);
            return ctx.json({ error: "Failed to update opening hours" }, 500);
        }
    });

    readonly getMenu = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

        try {
            const menu = await this.venuesLogic.getMenu(venueId);
            return ctx.json({ menu });
        } catch (error: any) {
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            console.error("Get menu error:", error);
            return ctx.json({ error: "Failed to fetch menu" }, 500);
        }
    });

    readonly updateMenu = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

        try {
            const userId = this.getUserId(ctx);
            const body = await ctx.req.json();
            if (!body.menu) return ctx.json({ error: "menu is required" }, 400);

            const updated = await this.venuesLogic.updateMenu(userId, venueId, body.menu);
            return ctx.json({ venue: updated, message: "Menu updated" });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);

            console.error("Update menu error:", error);
            return ctx.json({ error: "Failed to update menu" }, 500);
        }
    });

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
                if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

                const { booking_mode } = ctx.req.valid("json");
                const updated = await this.venuesLogic.updateBookingMode(userId, venueId, booking_mode);
                return ctx.json({ venue: updated });
            } catch (error: any) {
                if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
                if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
                if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);

                console.error("Update booking mode error:", error);
                return ctx.json({ error: "Failed to update booking mode" }, 500);
            }
        },
    );

    readonly setPrimaryPhoto = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        const photoId = ctx.req.param("photoId");
        if (!venueId || !photoId) return ctx.json({ error: "Venue ID and Photo ID are required" }, 400);

        try {
            const userId = this.getUserId(ctx);
            const photo = await this.venuesLogic.setPrimaryPhoto(userId, venueId, photoId);
            return ctx.json({ photo });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            if (error.message === "PHOTO_NOT_FOUND") return ctx.json({ error: "Photo not found" }, 404);
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);

            console.error("Set primary photo error:", error);
            return ctx.json({ error: "Failed to set primary photo" }, 500);
        }
    });

    readonly addOpeningHoursException = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const schema = z.object({
                date: z.string(),
                reason: z.string().min(1).max(255),
                closed: z.boolean(),
                special_hours: z.object({
                    open: z.string().regex(/^\d{2}:\d{2}$/),
                    close: z.string().regex(/^\d{2}:\d{2}$/),
                }).optional(),
            });
            const parsed = schema.safeParse(value);
            if (!parsed.success) {
                return ctx.json({ error: "Invalid request body", details: parsed.error }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            const venueId = ctx.req.param("venueId");
            if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

            try {
                const userId = this.getUserId(ctx);
                const body = ctx.req.valid("json");
                const exception = await this.venuesLogic.addOpeningHoursException(userId, venueId, body);
                return ctx.json({ exception }, 201);
            } catch (error: any) {
                if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
                if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
                if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);
                if (error.message === "DATE_IN_PAST") return ctx.json({ error: "Date must be in the future" }, 400);
                if (error.message === "EXCEPTION_EXISTS") return ctx.json({ error: "Exception already exists for this date" }, 400);

                console.error("Add opening hours exception error:", error);
                return ctx.json({ error: "Failed to add opening hours exception" }, 500);
            }
        }
    );

    readonly getOpeningHoursExceptions = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

        try {
            const from = ctx.req.query("from");
            const to = ctx.req.query("to");
            const upcomingOnly = ctx.req.query("upcoming_only") === "true";

            const options = {
                from: from ? new Date(from) : undefined,
                to: to ? new Date(to) : undefined,
                upcomingOnly,
            };

            const exceptions = await this.venuesLogic.getOpeningHoursExceptions(venueId, options);
            return ctx.json({ exceptions, total: exceptions.length });
        } catch (error: any) {
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            console.error("Get opening hours exceptions error:", error);
            return ctx.json({ error: "Failed to fetch opening hours exceptions" }, 500);
        }
    });

    readonly deleteOpeningHoursException = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        const exceptionId = ctx.req.param("exceptionId");
        if (!venueId || !exceptionId) return ctx.json({ error: "Venue ID and Exception ID are required" }, 400);

        try {
            const userId = this.getUserId(ctx);
            await this.venuesLogic.deleteOpeningHoursException(userId, venueId, exceptionId);
            return ctx.json({ success: true, message: "Exception deleted successfully" });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);
            if (error.message === "EXCEPTION_NOT_FOUND") return ctx.json({ error: "Exception not found" }, 404);

            console.error("Delete opening hours exception error:", error);
            return ctx.json({ error: "Failed to delete opening hours exception" }, 500);
        }
    });

    readonly getAllAmenities = this.factory.createHandlers(async (ctx) => {
        try {
            const amenities = await this.venuesLogic.getAllAmenities();

            const categories: Record<string, { slug: string; name: string; amenities: string[] }> = {};
            for (const amenity of amenities) {
                if (!categories[amenity.category]) {
                    categories[amenity.category] = {
                        slug: amenity.category,
                        name: amenity.category.charAt(0).toUpperCase() + amenity.category.slice(1),
                        amenities: [],
                    };
                }
                categories[amenity.category]!.amenities.push(amenity.id);
            }

            return ctx.json({
                amenities,
                categories: Object.values(categories),
            });
        } catch (error: any) {
            console.error("Get all amenities error:", error);
            return ctx.json({ error: "Failed to fetch amenities" }, 500);
        }
    });

    readonly getVenueAmenities = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

        try {
            const amenities = await this.venuesLogic.getVenueAmenities(venueId);
            return ctx.json({ amenities });
        } catch (error: any) {
            if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
            console.error("Get venue amenities error:", error);
            return ctx.json({ error: "Failed to fetch venue amenities" }, 500);
        }
    });

    readonly setVenueAmenities = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const schema = z.object({
                amenities: z.array(z.string()),
            });
            const parsed = schema.safeParse(value);
            if (!parsed.success) {
                return ctx.json({ error: "Invalid request body", details: parsed.error }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            const venueId = ctx.req.param("venueId");
            if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

            try {
                const userId = this.getUserId(ctx);
                const { amenities } = ctx.req.valid("json");
                const updatedAmenities = await this.venuesLogic.setVenueAmenities(userId, venueId, amenities);

                return ctx.json({
                    venue: {
                        id: venueId,
                        amenities: updatedAmenities,
                        updated_at: new Date().toISOString(),
                    },
                });
            } catch (error: any) {
                if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
                if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
                if (error.message === "FORBIDDEN") return ctx.json({ error: "Forbidden" }, 403);
                if (error.message?.startsWith("Invalid amenity IDs")) return ctx.json({ error: error.message }, 400);

                console.error("Set venue amenities error:", error);
                return ctx.json({ error: "Failed to update venue amenities" }, 500);
            }
        }
    );

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
                if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

                const { note } = ctx.req.valid("json");
                const result = await this.venuesLogic.addFavorite(userId, venueId, note);

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
                if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
                if (error.message === "VENUE_NOT_FOUND") return ctx.json({ error: "Venue not found" }, 404);
                if (error.message === "ALREADY_FAVORITED") return ctx.json({ error: "Venue is already in your favorites" }, 409);

                console.error("Add favorite error:", error);
                return ctx.json({ error: "Failed to add favorite" }, 500);
            }
        },
    );

    readonly removeFavorite = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const venueId = ctx.req.param("venueId");
            if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

            await this.venuesLogic.removeFavorite(userId, venueId);
            return ctx.json({ message: "Venue removed from favorites" });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "FAVORITE_NOT_FOUND") return ctx.json({ error: "Favorite not found" }, 404);

            console.error("Remove favorite error:", error);
            return ctx.json({ error: "Failed to remove favorite" }, 500);
        }
    });

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
                if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

                const { note } = ctx.req.valid("json");
                // Note is string | null, but TS sees it as string | null | undefined if optional. 
                // The schema says nullable() so it can be null.
                const updated = await this.venuesLogic.updateFavoriteNote(userId, venueId, note ?? null);

                return ctx.json({
                    message: "Favorite note updated",
                    favorite: updated,
                });
            } catch (error: any) {
                if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
                if (error.message === "FAVORITE_NOT_FOUND") return ctx.json({ error: "Favorite not found" }, 404);

                console.error("Update favorite note error:", error);
                return ctx.json({ error: "Failed to update favorite" }, 500);
            }
        },
    );

    readonly checkFavorite = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const venueId = ctx.req.param("venueId");
            if (!venueId) return ctx.json({ error: "Venue ID is required" }, 400);

            const favorite = await this.venuesLogic.checkFavorite(userId, venueId);

            return ctx.json({
                isFavorited: !!favorite,
                favorite: favorite ?? null,
            });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Check favorite error:", error);
            return ctx.json({ error: "Failed to check favorite" }, 500);
        }
    });
}

export default VenueController;