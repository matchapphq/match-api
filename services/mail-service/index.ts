import { isMailEnvVarsInit } from "./types/mail.types";
import { mailWorker } from "./worker/mail.worker";
import { Hono } from 'hono';

if (!isMailEnvVarsInit()) {
    console.error("[MAIL SERVICE]: Missing required environment variables. Please check your configuration.");
    process.exit(1);
}

const app = new Hono().get('/health', (c) => c.text('[MAIL WORKER]: Running !'));

mailWorker.on("completed", async (job) => {
    console.log(`[MAIL WORKER]: Job with id: ${job.id} completed`);
});

mailWorker.on("failed", async (job, err) => {
    const jobId = job?.id ?? "unknown";
    const errorMessage = err?.message ?? "Unknown error";
    console.error(`[MAIL WORKER]: Job with id: ${jobId} failed with error: ${errorMessage}`);
});

process.on('SIGTERM', async () => {
  await mailWorker.close();  // Graceful, no Redis close
  process.exit(0);
});

Bun.serve({
    port: 3000,
    fetch: app.fetch
})
