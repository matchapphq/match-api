import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "../types/hono.types";

/**
 * Middleware factory that checks if user has one of the required roles.
 * Must be used AFTER authMiddleware (which sets the user in context).
 */
export const requireRole = (...allowedRoles: Array<"user" | "venue_owner" | "admin">) => {
    return createMiddleware<HonoEnv>(async (c, next) => {
        const user = c.get('user');
        
        if (!user) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        if (!allowedRoles.includes(user.role)) {
            return c.json({ 
                error: "Forbidden", 
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')}` 
            }, 403);
        }

        await next();
    });
};

/**
 * Middleware that requires venue_owner or admin role
 */
export const venueOwnerMiddleware = requireRole("venue_owner", "admin");

/**
 * Middleware that requires admin role
 */
export const adminMiddleware = requireRole("admin");
