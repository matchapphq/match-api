import { Worker } from "bullmq";
import app from "./src/server";
import isEnvsDefined from "./src/utils/checkEnv";
import { redisConnection } from "./src/config/redis";

if (!isEnvsDefined()) {
    console.error("[ERROR]: Environment variables are not defined.");
    process.exit(84);
}

Bun.serve({
    port: parseInt(Bun.env.PORT || "8008"),
    fetch: app.fetch,
})
