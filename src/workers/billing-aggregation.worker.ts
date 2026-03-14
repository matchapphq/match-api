import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { BillingAggregationService } from "../services/billing-aggregation.service";

const billingService = new BillingAggregationService();

export const billingWorker = new Worker("billing-aggregation", async (job: Job) => {
    console.log(`[Billing Worker] Starting job ${job.id}: ${job.name}`);

    try {
        if (job.name === "MONTHLY_USAGE_AGGREGATION") {
            const result = await billingService.processMonthlyBilling();
            return result;
        }
        
        console.warn(`[Billing Worker] Unknown job name: ${job.name}`);
    } catch (error: any) {
        console.error(`[Billing Worker] Error in job ${job.id}:`, error.message);
        throw error;
    }

}, { 
    connection: redisConnection,
    concurrency: 1, // Process one group at a time to be safe with Stripe limits
});

billingWorker.on("completed", (job) => {
    console.log(`[Billing Worker] Job ${job.id} completed successfully`);
});

billingWorker.on("failed", (job, err) => {
    console.error(`[Billing Worker] Job ${job?.id} failed:`, err.message);
});
