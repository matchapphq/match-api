import type { ConnectionOptions } from "bullmq";

export const redisConnection: ConnectionOptions = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: Bun.env.REDIS_PASSWORD || undefined,
    db: parseInt(Bun.env.REDIS_DB || '0'),
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
};
