import { createFactory } from "hono/factory";
import { z } from "zod";
import { validator } from "hono/validator";
import type { Context } from "hono";

import { FavoritesRepository } from "../../repository/favorites.repository";
import type { HonoEnv } from "../../types/hono.types";
import UserRepository from "../../repository/user.repository";

// Validation schema for pagination
const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * Controller for User operations.
 */
class UserController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly favoritesRepository = new FavoritesRepository();
    private readonly userRepository = new UserRepository();

    // Helper to get user ID from context
    private getUserId(ctx: Context<HonoEnv>): string {
        const user = ctx.get('user');
        if (!user || !user.id) {
            throw new Error("Unauthorized");
        }
        return user.id;
    }

    readonly getMe = this.factory.createHandlers(async (ctx) => {
        const user = ctx.get('user');
        let _userData;
        if (!user) {
            throw new Error("Unauthorized");
        }
        
        try {
          _userData = await this.userRepository.getMe({id: user.id});
          
          if (!_userData) {
            throw new Error("User not found");
          }
          
          return ctx.json({ msg: "Get current user profile", user: _userData });
        } catch (error) {
            throw new Error("Failed to fetch user data");
        }
    });

    readonly updateMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Update current user profile" });
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

    readonly completeOnboarding = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Mark onboarding as complete" });
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

            const result = await this.favoritesRepository.getFavorites(userId, { page, limit });

            return ctx.json(result);

        } catch (error: any) {
            if (error.message === "Unauthorized") return ctx.json({ error: "Unauthorized" }, 401);
            console.error("Get favorites error:", error);
            return ctx.json({ error: "Failed to fetch favorites" }, 500);
        }
    });
}

export default UserController;
