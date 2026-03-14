import { billingQueue } from "../queue/billing.queue";

const MONTHLY_BILLING_CRON_PATTERN = "55 23 28-31 * *";
const MONTHLY_BILLING_SCHEDULER_ID = "monthly_billing_aggregation";
const MONTHLY_BILLING_JOB_NAME = "MONTHLY_USAGE_AGGREGATION";

export async function setupScheduler() {
    console.log("[Scheduler] Setting up recurring jobs...");

    const existingSchedulers = await billingQueue.getJobSchedulers();
    for (const scheduler of existingSchedulers) {
        const schedulerId = scheduler.id || scheduler.key;
        if (!schedulerId) {
            continue;
        }

        if (scheduler.name === MONTHLY_BILLING_JOB_NAME && schedulerId !== MONTHLY_BILLING_SCHEDULER_ID) {
            await billingQueue.removeJobScheduler(schedulerId);
        }
    }

    await billingQueue.upsertJobScheduler(
        MONTHLY_BILLING_SCHEDULER_ID,
        {
            pattern: MONTHLY_BILLING_CRON_PATTERN,
        },
        {
            name: MONTHLY_BILLING_JOB_NAME,
            data: {},
            opts: {
                removeOnComplete: true,
            },
        },
    );

    console.log(`[Scheduler] Billing aggregation scheduler "${MONTHLY_BILLING_SCHEDULER_ID}" set with cron "${MONTHLY_BILLING_CRON_PATTERN}" (month-end guarded).`);
}
