import type { ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";

const getRedisConfig = (): ConnectionOptions => {
    if (process.env.REDIS_URL) {
        console.log(`[Redis] Connecting via REDIS_URL`);
        // If it's a URL, we need to parse it or just use it if ioredis supports it in this context.
        // BullMQ connection can be an existing ioredis instance or options.
        // For simplicity, we'll return an object that ioredis can handle.
        try {
            const url = new URL(process.env.REDIS_URL);
            return {
                host: url.hostname,
                port: parseInt(url.port) || 6379,
                password: url.password || undefined,
                lazyConnect: true,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
            };
        } catch (e) {
            console.warn("[Redis] Failed to parse REDIS_URL, falling back to components");
        }
    }

    const host = process.env.REDIS_HOST || "127.0.0.1";
    const port = parseInt(process.env.REDIS_PORT || "6380");
    const password = process.env.REDIS_PASSWORD || Bun.env.REDIS_PASSWORD;

    console.log(`[Redis] Connecting to ${host}:${port}`);

    return {
        host,
        port,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    };
};

export const redisConnection = getRedisConfig();
