import { createMiddleware } from "hono/factory";
import { JwtUtils } from "../utils/jwt";
import { getSignedCookie } from "hono/cookie";

export const authMiddleware = createMiddleware(async (c, next) => {
    if (!Bun.env.ACCESS_JWT_SIGN_KEY) {
        return c.json({ error: "JWT signing key not found" }, 500);
    }

    let token = await getSignedCookie(c, Bun.env.ACCESS_JWT_SIGN_KEY, "access_token");

    // If no cookie, check Authorization header (Bearer token)
    if (!token) {
        const authHeader = c.req.header("Authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }
    }

    if (!token) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = await JwtUtils.verifyAccessToken(token);

    if (!payload) {
        return c.json({ error: "Invalid token" }, 401);
    }

    c.set('user', payload);

    await next();
});
