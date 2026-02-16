import { createFactory } from "hono/factory";
import { z } from "zod";
import { validator } from "hono/validator";
import type { Context } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import { UserLogic } from "./user.logic";

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

    readonly deleteMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Delete user account" });
    });

    readonly getUserProfile = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get public user profile" });
    });

    readonly updateNotificationPreferences = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Update notification settings" });
    });

    readonly getAddresses = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Get user addresses" });
    });

    readonly addAddress = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Add new address" });
    });

    readonly updateAddress = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Update address" });
    });

    readonly deleteAddress = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Delete address" });
    });

    /**
     * GET /users/me/favorite-venues - List user's favorite venues with pagination
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