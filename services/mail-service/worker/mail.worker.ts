import { Worker } from "bullmq";
import { redisConfig } from "../config/redis";

export const mailWorker = new Worker("mail-queue", async (job) => {
    console.log(`Processing job: ${job.name} with ${job.data.from}`);
}, {
    connection: redisConfig,
    concurrency: 50,
    removeOnFail: {
        age: 2 * 24 * 3600,
        count: 1000,
    },
    removeOnComplete: {
        age: 3600,
        count: 100,
    },
});
