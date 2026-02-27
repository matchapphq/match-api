import { createMiddleware } from "hono/factory";
import { JwtUtils } from "../utils/jwt";
import { getSignedCookie } from "hono/cookie";
import TokenRepository from "../repository/token.repository";

const tokenRepository = new TokenRepository();
const parsePositiveDays = (envValue: string | undefined, defaultDays: number): number => {
    const parsed = Number(envValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultDays;
};
const sessionInactivityMs =
    parsePositiveDays(process.env.SESSION_INACTIVITY_DAYS, 7) * 24 * 60 * 60 * 1000;

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

    try {
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
    } catch (error) {
        console.error("[AUTH_MIDDLEWARE] Failed to validate session:", error);
        return c.json({ error: "Failed to validate session" }, 500);
    }

    c.set('user', payload);

    await next();
});
