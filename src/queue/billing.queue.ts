import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const billingQueue = new Queue("billing-aggregation", { 
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
    }
});
