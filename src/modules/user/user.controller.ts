import { createFactory } from "hono/factory";
import { z } from "zod";
import { validator } from "hono/validator";
import type { Context } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import { UserLogic } from "./user.logic";
import { zValidator } from "@hono/zod-validator";
import { DeleteRequestSchema, type DeleteRequestSchemaType, UpdatePasswordSchema, type UpdatePasswordSchemaType } from "../../utils/users.valid";

// Validation schema for pagination
const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * Controller for User operations.
 * Handles HTTP mapping and uses UserLogic for business rules.
 */
class UserController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly userLogic: UserLogic) {}

    // Helper to get user ID from context
    private getUserId(ctx: Context<HonoEnv>): string {
        const user = ctx.get('user');
        if (!user || !user.id) {
            throw new Error("Unauthorized");
        }
        return user.id;
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
            if (error.message === "INVALID_CURRENT_PASSWORD") {
                return ctx.json({ error: "Current password is incorrect" }, 400);
            }
            
            console.error("Error updating password:", error);
            return ctx.json({ error: "Failed to update password" }, 500);
        }
    });

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
            console.error("Error deleting user:", error);
            return ctx.json({ error: "Failed to delete user account" }, 500);
        }
        return ctx.json({ msg: "Delete user account" });
    });

    readonly getUserProfile = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get public user profile" });
    });

    readonly updateNotificationPreferences = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Update notification settings" });
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