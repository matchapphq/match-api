import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";
import type { StripeJobPayload } from "../types/jobs.type";

export const stripeQueue = new Queue<StripeJobPayload>("stripe", { 
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
    }
});