import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import type { NotificationPayload } from "../types/jobs.type";

const notificationWorker = new Worker<NotificationPayload>("notification", async (job: Job) => {
    console.log(`Processing job ${job.id}`);
    console.log(typeof job.data);
}, { connection: redisConnection });

notificationWorker.on("completed", async (job: Job) => {
    console.log(`Job ${job.id} completed`);
});


export {
    notificationWorker
}

