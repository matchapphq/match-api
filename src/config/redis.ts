import type { ConnectionOptions } from "bullmq";

export const redisConnection: ConnectionOptions = {
    //url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
    port: parseInt(process.env.REDIS_PORT || "6379"),
    host: process.env.REDIS_HOST || "localhost",
    password: process.env.REDIS_PASSWORD || Bun.env.REDIS_PASSWORD,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
};
