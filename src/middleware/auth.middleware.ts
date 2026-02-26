import { createMiddleware } from "hono/factory";
import { JwtUtils } from "../utils/jwt";
import { getSignedCookie } from "hono/cookie";
import TokenRepository from "../repository/token.repository";

const tokenRepository = new TokenRepository();
const sessionInactivityMs =
    Math.max(1, Number(process.env.SESSION_INACTIVITY_DAYS || 7)) * 24 * 60 * 60 * 1000;

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

    const tokenSessionId = typeof payload.sid === "string" ? payload.sid : undefined;
    if (!payload.id || !tokenSessionId) {
        return c.json({ error: "Session invalid" }, 401);
    }

    const session = await tokenRepository.getTokenById(tokenSessionId);
    if (!session || session.userId !== payload.id) {
        return c.json({ error: "Session revoked" }, 401);
    }

    const sessionUpdatedAt =
        session.updated_at instanceof Date ? session.updated_at.getTime() : new Date(session.updated_at).getTime();
    if (!Number.isFinite(sessionUpdatedAt) || sessionUpdatedAt <= Date.now() - sessionInactivityMs) {
        await tokenRepository.deleteToken(session.id).catch(() => undefined);
        return c.json({ error: "Session expired inactive" }, 401);
    }

    c.set('user', payload);

    await next();
});
