import app from "./src/server";
import isEnvsDefined from "./src/utils/checkEnv";
import { mailWorker } from "./src/workers/mail.worker";

if (!isEnvsDefined()) {
    console.error("[ERROR]: Environment variables are not defined.");
    process.exit(84);
}

mailWorker.on("completed", async (job) => {
    console.log(`[MAIL WORKER]: Job with id: ${job.id} completed`);
});

mailWorker.on("failed", async (job, err) => {
    console.error(`[MAIL WORKER]: Job with id: ${job.id} failed with error: ${err.message}`);
});

process.on('SIGTERM', async () => {
  await mailWorker.close();  // Graceful, no Redis close
  process.exit(0);
});
Bun.serve({
    port: parseInt(Bun.env.PORT || "8008"),
    fetch: app.fetch,
})
