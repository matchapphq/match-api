import { createFactory } from "hono/factory";
import { z } from "zod";
import { validator } from "hono/validator";
import type { Context } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import { UserLogic } from "./user.logic";
import { zValidator } from "@hono/zod-validator";
import {
    DeleteRequestSchema,
    type DeleteRequestSchemaType,
    UpdateNotificationPreferencesSchema,
    type UpdateNotificationPreferencesSchemaType,
    UpdatePasswordSchema,
    type UpdatePasswordSchemaType,
    UpdatePrivacyPreferencesSchema,
    type UpdatePrivacyPreferencesSchemaType,
} from "../../utils/users.valid";
import { encodeSessionDevice, resolveSessionDeviceFromHeaders } from "../../utils/session-device";

// Validation schema for pagination
const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const SessionParamSchema = z.object({
    sessionId: z.string().uuid(),
});

/**
 * Controller for User operations.
 * Handles HTTP mapping and uses UserLogic for business rules.
 */
class UserController {
    private readonly factory = createFactory<HonoEnv>();
    private static readonly MAX_LOCATION_OVERRIDE_LENGTH = 120;

    constructor(private readonly userLogic: UserLogic) {}

    // Helper to get user ID from context
    private getUserId(ctx: Context<HonoEnv>): string {
        const user = ctx.get('user');
        if (!user || !user.id) {
            throw new Error("Unauthorized");
        }
        return user.id;
    }

    private getTokenIssuedAt(ctx: Context<HonoEnv>): number | undefined {
        const user = ctx.get('user') as (HonoEnv["Variables"]["user"] & { iat?: number }) | undefined;
        return typeof user?.iat === "number" ? user.iat : undefined;
    }

    private getTokenSessionId(ctx: Context<HonoEnv>): string | undefined {
        const user = ctx.get('user') as (HonoEnv["Variables"]["user"] & { sid?: string }) | undefined;
        return typeof user?.sid === "string" ? user.sid : undefined;
    }

    private parseLocationOverride(rawBody: unknown):
        | {
              city: string | null;
              region: string | null;
              country: string | null;
          }
        | null {
        if (!rawBody || typeof rawBody !== "object") {
            return null;
        }

        const maybeLocation = Reflect.get(rawBody as object, "location");
        if (!maybeLocation || typeof maybeLocation !== "object") {
            return null;
        }

        const clean = (value: unknown): string | null => {
            if (typeof value !== "string") return null;
            const trimmed = value.trim();
            if (trimmed.length === 0) return null;
            return trimmed.slice(0, UserController.MAX_LOCATION_OVERRIDE_LENGTH);
        };

        const city = clean(Reflect.get(maybeLocation as object, "city"));
        const region = clean(Reflect.get(maybeLocation as object, "region"));
        const country = clean(Reflect.get(maybeLocation as object, "country"));

        if (!city && !region && !country) {
            return null;
        }

        return { city, region, country };
    }

    /**
     * GET /users/me
     */
    public readonly getMe = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const user = await this.userLogic.getUserProfile(userId);
            return ctx.json({ user });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "USER_NOT_FOUND") return ctx.json({ error: "User not found" }, 404);
            
            console.error("Error fetching user:", error);
            return ctx.json({ error: "Failed to fetch user data" }, 500);
        }
    });

    readonly updateMe = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const body = await ctx.req.json();
            
            // Basic validation
            const updateData = {
                first_name: body.first_name,
                last_name: body.last_name,
                email: body.email,
                phone: body.phone,
                bio: body.bio,
                avatar: body.avatar,
                fav_sports: Array.isArray(body.fav_sports) ? body.fav_sports : undefined,
                fav_team_ids: Array.isArray(body.fav_team_ids) ? body.fav_team_ids : undefined,
                ambiances: Array.isArray(body.ambiances) ? body.ambiances : undefined,
                venue_types: Array.isArray(body.venue_types) ? body.venue_types : undefined,
                budget: typeof body.budget === "string" ? body.budget : undefined,
                home_lat: typeof body.home_lat === "number" ? body.home_lat : undefined,
                home_lng: typeof body.home_lng === "number" ? body.home_lng : undefined,
            };

            // Remove undefined fields
            Object.keys(updateData).forEach(key => (updateData as any)[key] === undefined && delete (updateData as any)[key]);

            const user = await this.userLogic.updateUser(userId, updateData);
            return ctx.json({ user });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "USER_NOT_FOUND") return ctx.json({ error: "User not found" }, 404);
            
            console.error("Error updating user:", error);
            return ctx.json({ error: "Failed to update user data" }, 500);
        }
    });

    readonly updatePassword = this.factory.createHandlers(zValidator("json", UpdatePasswordSchema), async (ctx) => {
        const body: UpdatePasswordSchemaType = ctx.req.valid("json");
        
        try {
            const userId = this.getUserId(ctx);
            await this.userLogic.updatePassword(userId, {
                current_password: body.current_password,
                new_password: body.new_password,
            });
            
            return ctx.json({ message: "Password updated successfully" });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "USER_NOT_FOUND") return ctx.json({ error: "User not found" }, 404);
            if (error.message === "CURRENT_PASSWORD_REQUIRED") {
                return ctx.json({ error: "Current password is required" }, 400);
            }
            if (error.message === "INVALID_CURRENT_PASSWORD") {
                return ctx.json({ error: "Current password is incorrect" }, 400);
            }
            
            console.error("Error updating password:", error);
            return ctx.json({ error: "Failed to update password" }, 500);
        }
    });

    readonly getSessions = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const tokenSessionId = this.getTokenSessionId(ctx);
            const sessions = await this.userLogic.getSessions(
                userId,
                this.getTokenIssuedAt(ctx),
                tokenSessionId,
            );

            const shouldHydrateCurrentSessionLocation = Boolean(
                tokenSessionId &&
                sessions.some((session) =>
                    session.id === tokenSessionId &&
                    !Boolean(session.location?.city || session.location?.region || session.location?.country),
                ),
            );
            const resolvedDevice = shouldHydrateCurrentSessionLocation
                ? await resolveSessionDeviceFromHeaders(
                    ctx.req.raw.headers,
                    ctx.req.header("User-Agent"),
                )
                : null;

            const hydratedSessions = sessions.map((session) => {
                if (session.id !== tokenSessionId) return session;

                const hasStoredLocation = Boolean(
                    session.location?.city || session.location?.region || session.location?.country,
                );

                if (hasStoredLocation) return session;

                return {
                    ...session,
                    location: {
                        city: session.location?.city || resolvedDevice?.location.city || null,
                        region: session.location?.region || resolvedDevice?.location.region || null,
                        country: session.location?.country || resolvedDevice?.location.country || null,
                    },
                };
            });

            return ctx.json({ sessions: hydratedSessions });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Error fetching sessions:", error);
            return ctx.json({ error: "Failed to fetch sessions" }, 500);
        }
    });

    readonly revokeOtherSessions = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const result = await this.userLogic.revokeOtherSessions(
                userId,
                this.getTokenIssuedAt(ctx),
                this.getTokenSessionId(ctx),
            );
            return ctx.json({
                message: "Other sessions revoked",
                revoked: result.revoked,
                kept_session_id: result.kept_session_id,
            });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Error revoking other sessions:", error);
            return ctx.json({ error: "Failed to revoke other sessions" }, 500);
        }
    });

    readonly revokeSession = this.factory.createHandlers(
        zValidator("param", SessionParamSchema),
        async (ctx) => {
            const { sessionId } = ctx.req.valid("param");

            try {
                const userId = this.getUserId(ctx);
                await this.userLogic.revokeSession(userId, sessionId);
                return ctx.json({ message: "Session revoked" });
            } catch (error: any) {
                if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
                if (error.message === "SESSION_NOT_FOUND") return ctx.json({ error: "Session not found" }, 404);
                console.error("Error revoking session:", error);
                return ctx.json({ error: "Failed to revoke session" }, 500);
            }
        },
    );

    readonly deleteMe = this.factory.createHandlers(zValidator("json", DeleteRequestSchema), async (ctx) => {
        const body: DeleteRequestSchemaType = ctx.req.valid("json");
        
        try {
            const userId = this.getUserId(ctx);
            const result = await this.userLogic.deleteUser(userId, body.reason, body.details, body.password);
            
            if (!result) {
                return ctx.json({ error: "Failed to delete user account" }, 400);
            }
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "USER_NOT_FOUND") return ctx.json({ error: "User not found" }, 404);
            if (error.message === "PASSWORD_REQUIRED") {
                return ctx.json({ error: "Password is required" }, 400);
            }
            if (error.message === "INVALID_PASSWORD") {
                return ctx.json({ error: "Invalid password" }, 400);
            }
            console.error("Error deleting user:", error);
            return ctx.json({ error: "Failed to delete user account" }, 500);
        }
        return ctx.json({ msg: "Delete user account" });
    });

    readonly getUserProfile = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get public user profile" });
    });

    readonly getNotificationPreferences = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const preferences = await this.userLogic.getNotificationPreferences(userId);
            return ctx.json(preferences);
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Error fetching notification preferences:", error);
            return ctx.json({ error: "Failed to fetch notification preferences" }, 500);
        }
    });

    readonly updateNotificationPreferences = this.factory.createHandlers(
        zValidator("json", UpdateNotificationPreferencesSchema),
        async (ctx) => {
            try {
                const userId = this.getUserId(ctx);
                const body: UpdateNotificationPreferencesSchemaType = ctx.req.valid("json");
                const preferences = await this.userLogic.updateNotificationPreferences(userId, body);
                return ctx.json(preferences);
            } catch (error: any) {
                if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
                console.error("Error updating notification preferences:", error);
                return ctx.json({ error: "Failed to update notification preferences" }, 500);
            }
        },
    );

    readonly getPrivacyPreferences = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const preferences = await this.userLogic.getPrivacyPreferences(userId);
            return ctx.json(preferences);
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Error fetching privacy preferences:", error);
            return ctx.json({ error: "Failed to fetch privacy preferences" }, 500);
        }
    });

    readonly updatePrivacyPreferences = this.factory.createHandlers(
        zValidator("json", UpdatePrivacyPreferencesSchema),
        async (ctx) => {
            try {
                const userId = this.getUserId(ctx);
                const body: UpdatePrivacyPreferencesSchemaType = ctx.req.valid("json");
                const preferences = await this.userLogic.updatePrivacyPreferences(userId, body);
                return ctx.json(preferences);
            } catch (error: any) {
                if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
                console.error("Error updating privacy preferences:", error);
                return ctx.json({ error: "Failed to update privacy preferences" }, 500);
            }
        },
    );

    /**
     * POST /users/me/session-heartbeat
     * Explicitly refresh session last activity.
     */
    readonly touchSessionHeartbeat = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            let body: unknown = null;
            try {
                body = await ctx.req.json();
            } catch {}

            const locationOverride = this.parseLocationOverride(body);
            const resolvedDevice = await resolveSessionDeviceFromHeaders(
                ctx.req.raw.headers,
                ctx.req.header("User-Agent"),
            );

            if (locationOverride) {
                resolvedDevice.location = {
                    city: locationOverride.city || resolvedDevice.location.city,
                    region: locationOverride.region || resolvedDevice.location.region,
                    country: locationOverride.country || resolvedDevice.location.country,
                };
            }

            const sessionDevice = encodeSessionDevice(resolvedDevice);
            await this.userLogic.touchSessionActivity(
                userId,
                this.getTokenIssuedAt(ctx),
                this.getTokenSessionId(ctx),
                sessionDevice,
            );
            return ctx.json({ success: true });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            return ctx.json({ error: "Failed to update session activity" }, 500);
        }
    });

    /**
     * PUT /users/me/push-token - Update user's push token
     */
    readonly updatePushToken = this.factory.createHandlers(async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const { push_token } = await ctx.req.json();

            if (!push_token) {
                return ctx.json({ error: "push_token is required" }, 400);
            }

            await this.userLogic.updatePushToken(userId, push_token);
            return ctx.json({ success: true });
        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            if (error.message === "USER_NOT_FOUND") return ctx.json({ error: "User not found" }, 404);
            console.error("Error updating push token:", error);
            return ctx.json({ error: "Failed to update push token" }, 500);
        }
    });
    /**
     * GET /users/me/favorites - List user's favorite venues with pagination
     */
    readonly getFavorites = this.factory.createHandlers(validator('query', (value, ctx) => {
        const parsed = PaginationSchema.safeParse(value);
        if (!parsed.success) {
            return ctx.json({ error: "Invalid query params", details: parsed.error }, 400);
        }
        return parsed.data;
    }), async (ctx) => {
        try {
            const userId = this.getUserId(ctx);
            const { page, limit } = ctx.req.valid('query');

            const result = await this.userLogic.getFavorites(userId, { page, limit });

            return ctx.json(result);

        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Get favorites error:", error);
            return ctx.json({ error: "Failed to fetch favorites" }, 500);
        }
    });
}

export default UserController;
