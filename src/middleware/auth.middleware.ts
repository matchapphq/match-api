import { createMiddleware } from "hono/factory";
import { JwtUtils } from "../utils/jwt";
import { getCookie } from "hono/cookie";

export const authMiddleware = createMiddleware(async (c, next) => {
    const cookie = getCookie(c, "access_token");
    
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
