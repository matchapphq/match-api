import type { ConnectionOptions } from "bullmq";

export const redisConfig: ConnectionOptions = {
    //url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
    port: parseInt(process.env.REDIS_PORT as string),
    host: process.env.REDIS_HOST,
    password: Bun.env.REDIS_PASSWORD,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
}
