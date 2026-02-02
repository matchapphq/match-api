import { mailWorker } from "./worker/mail.worker";
import { Hono } from 'hono';

const app = new Hono().get('/health', (c) => c.text('[MAIL WORKER]: Running !'));

mailWorker.on("completed", async (job) => {
    console.log(`[MAIL WORKER]: Job with id: ${job.id} completed`);
});

mailWorker.on("active", async (job) => {
    console.log(`[MAIL WORKER]: Job with id: ${job.id} is active`);
});

mailWorker.on("progress", async (job, progress) => {
    console.log(`[MAIL WORKER]: Job with id: ${job.id} is ${progress}% complete`);
});

mailWorker.on("failed", async (job, err) => {
    console.error(`[MAIL WORKER]: Job with id: ${job.id} failed with error: ${err.message}`);
});

Bun.serve({
    port: 3000,
    fetch: app.fetch
})
