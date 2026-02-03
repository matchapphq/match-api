import { mailWorker } from "./worker/mail.worker";
import { Hono } from 'hono';

const app = new Hono().get('/health', (c) => c.text('[MAIL WORKER]: Running !'));

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
    port: 3000,
    fetch: app.fetch
})
