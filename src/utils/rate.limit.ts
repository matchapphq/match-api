import { rateLimiter } from "hono-rate-limiter";
import type { HonoEnv } from "../types/hono.types";

// Conservative auth limiter; can be mounted on auth routes.
export const authLimiter = rateLimiter<HonoEnv>({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    keyGenerator: (c) => {
        const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
        const realIp = c.req.header("x-real-ip")?.trim();
        return `auth:${forwardedFor || realIp || "unknown"}`;
    },
});
