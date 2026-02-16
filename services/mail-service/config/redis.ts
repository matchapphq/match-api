import type { ConnectionOptions } from "bullmq";

export const redisConfig: ConnectionOptions = {
    url: process.env.REDIS_URL || `redis://default:${process.env.REDIS_PASSWORD || ""}@${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
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
