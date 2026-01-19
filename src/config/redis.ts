import IOredis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisConnection = new IOredis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null, 
});

process.on("SIGTERM", async () => {
    await redisConnection.quit();
    process.exit(0);
});
