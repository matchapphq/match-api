import { mailWorker } from "./worker/mail.worker";

mailWorker.on("completed", async (job) => {
    console.log(`Job ${job.id} completed`);
});

mailWorker.on("failed", async (job, err) => {
    console.error(`Job ${job.id} failed with error: ${err.message}`);
});
