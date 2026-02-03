import type { ConnectionOptions } from "bullmq";

export const redisConfig: ConnectionOptions = {
    url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
    // host: process.env.REDIS_HOST || "localhost",
    // port: parseInt(process.env.REDIS_PORT || "6379"),
    // password: Bun.env.REDIS_PASSWORD || undefined,
    // db: parseInt(Bun.env.REDIS_DB || '0'),
    connectTimeout: 5000,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    reconnectOnError: (error) => {
        console.error("Redis connection error:", error);
        return true;
    },
    shardedSubscribers: true
}
