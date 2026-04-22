import type { ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";

const getRedisConfig = (): ConnectionOptions => {
    const host = process.env.REDIS_HOST || "127.0.0.1";
    const port = parseInt(process.env.REDIS_PORT || "6380");
    const password = process.env.REDIS_PASSWORD || Bun.env.REDIS_PASSWORD;

    console.log(`[Redis] Connecting to ${host}:${port}`);

    return {
        host,
        port,
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    };
};

export const redisConnection = getRedisConfig();
