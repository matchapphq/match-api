import { Worker } from "bullmq";
import { redisConfig } from "../config/redis";

export const mailWorker = new Worker("mail-queue", async (job) => {
    console.log(`Processing job: ${job.name} with ${job.data.from}`);
}, { connection: redisConfig, concurrency: 3 });
