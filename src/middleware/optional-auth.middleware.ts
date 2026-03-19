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

/**
 * Middleware that tries to authenticate the user but doesn't fail if no token is provided.
 * If authentication fails for other reasons (e.g. invalid token), it still doesn't fail.
 */
export const optionalAuthMiddleware = createMiddleware(async (c, next) => {
    if (!Bun.env.ACCESS_JWT_SIGN_KEY) {
        return await next();
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
        return await next();
    }

    let payload;
    try {
        payload = await JwtUtils.verifyAccessToken(token);
    } catch (error) {
        // Silently ignore verification errors in optional middleware
        return await next();
    }

    if (!payload) {
        return await next();
    }

    const tokenSessionId = typeof payload.sid === "string" ? payload.sid : undefined;
    if (!payload.id || !tokenSessionId) {
        return await next();
    }

    try {
        const session = await tokenRepository.getTokenById(tokenSessionId);
        if (!session || session.userId !== payload.id) {
            return await next();
        }

        const sessionUpdatedAt =
            session.updated_at instanceof Date ? session.updated_at.getTime() : new Date(session.updated_at).getTime();
        if (!Number.isFinite(sessionUpdatedAt) || sessionUpdatedAt <= Date.now() - sessionInactivityMs) {
            return await next();
        }
    } catch (error) {
        // Silently ignore session lookup errors
        return await next();
    }

    c.set('user', payload);

    await next();
});
