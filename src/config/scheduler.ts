import { billingQueue } from "../queue/billing.queue";

export async function setupScheduler() {
    console.log("[Scheduler] Setting up recurring jobs...");

    // 1. Monthly commission collection.
    // Runs on days 28-31 at 23:55 and the service keeps only the true last day.
    await billingQueue.add("MONTHLY_USAGE_AGGREGATION", {},
        {
            repeat: {
                pattern: "55 23 28-31 * *",
            },
            jobId: "monthly_billing_aggregation", // Prevent duplicates
        },
    );

    console.log("[Scheduler] Monthly billing aggregation scheduled (last day of month at 23:55).");
}
