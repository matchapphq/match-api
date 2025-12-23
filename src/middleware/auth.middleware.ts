import { createMiddleware } from "hono/factory";
import { JwtUtils } from "../utils/jwt";
import { getSignedCookie } from "hono/cookie";

export const authMiddleware = createMiddleware(async (c, next) => {
    if (!Bun.env.ACCESS_JWT_SIGN_KEY) {
        return c.json({ error: "JWT signing key not found" }, 500);
    }
    
    const cookie = await getSignedCookie(c, Bun.env.ACCESS_JWT_SIGN_KEY, "access_token");
    if (!cookie) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    
    const token = cookie;
    const payload = await JwtUtils.verifyAccessToken(token);

    if (!payload) {
        return c.json({ error: "Invalid token" }, 401);
    }

    c.set('user', payload);
    
    await next();
});
