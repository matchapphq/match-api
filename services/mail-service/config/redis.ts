import type { ConnectionOptions } from "bullmq";

export const redisConfig: ConnectionOptions = {
    url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    enableReadyCheck: false
}