import { billingQueue } from "../queue/billing.queue";

export async function setupScheduler() {
    console.log("[Scheduler] Setting up recurring jobs...");

    // 1. Monthly Usage Aggregation (Runs on the 29th of every month at 03:00 AM)
    // Cron: 0 3 29 * *
    await billingQueue.add("MONTHLY_USAGE_AGGREGATION", {},
        {
            repeat: {
                pattern: "0 3 29 * *",
            },
            jobId: "monthly_billing_aggregation", // Prevent duplicates
        }
    );

    console.log("[Scheduler] Monthly billing aggregation scheduled for the 29th.");
}
