import { rateLimiter, RedisStore } from "hono-rate-limiter"
import type { HonoEnv } from "../types/hono.types";
import IORedis from "ioredis";
import { getConnInfo } from "hono/bun"
import { redisConnection } from "../config/redis";

export const redisCli = new IORedis(process.env.REDIS_URL!);

const redisStore = new RedisStore({
    sendCommand: (...args: string[]) => redis.sendCommand(args as any)
});

const authLimiter = rateLimiter<HonoEnv>({
  windowMs: 60 * 1000,  // 1 min
  limit: 10,
  store: yourRedisStore,
  keyGenerator: (c) => `auth:${getClientIp(c)}`,
  standardHeaders: 'draft-7',
});