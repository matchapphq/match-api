import type { ConnectionOptions } from "bullmq";

const DEFAULT_REDIS_HOST = "localhost";
const DEFAULT_REDIS_PORT = 6379;

function getRedisPort(): number {
    const rawPort = process.env.REDIS_PORT;
    if (!rawPort) return DEFAULT_REDIS_PORT;

    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        console.warn(
            `[MAIL SERVICE]: Invalid REDIS_PORT "${rawPort}", falling back to ${DEFAULT_REDIS_PORT}.`,
        );
        return DEFAULT_REDIS_PORT;
    }

    return port;
}

export const redisConfig: ConnectionOptions = {
    //url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
    port: getRedisPort(),
    host: process.env.REDIS_HOST || DEFAULT_REDIS_HOST,
    password: process.env.REDIS_PASSWORD || Bun.env.REDIS_PASSWORD,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
}
