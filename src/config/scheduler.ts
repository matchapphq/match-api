import { billingQueue } from "../queue/billing.queue";
import { notificationQueue } from "../queue/notification.queue";
import { triggerUpcomingMatchNotifications } from "../services/notifications/team-upcoming-match.trigger";
import { NotificationType } from "../types/jobs.type";

const MONTHLY_BILLING_CRON_PATTERN = "55 23 28-31 * *";
const MONTHLY_BILLING_SCHEDULER_ID = "monthly_billing_aggregation";
const MONTHLY_BILLING_JOB_NAME = "MONTHLY_USAGE_AGGREGATION";

const UPCOMING_MATCHES_CRON_PATTERN = "0 * * * *"; // Every hour
const UPCOMING_MATCHES_SCHEDULER_ID = "check_upcoming_matches";
const UPCOMING_MATCHES_JOB_NAME = "CHECK_UPCOMING_MATCHES";

export async function setupScheduler() {
    console.log("[Scheduler] Setting up recurring jobs...");

    // Billing Queue Schedulers
    const existingBillingSchedulers = await billingQueue.getJobSchedulers();
    for (const scheduler of existingBillingSchedulers) {
        const schedulerId = scheduler.id || scheduler.key;
        if (!schedulerId) continue;

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

    // Define a repeatable worker for upcoming matches directly via setInterval or a simple worker if we don't want to use BullMQ schedulers just for checking.
    // Actually, since BullMQ provides schedulers, we can use the notificationQueue.
    const existingNotifSchedulers = await notificationQueue.getJobSchedulers();
    for (const scheduler of existingNotifSchedulers) {
        const schedulerId = scheduler.id || scheduler.key;
        if (!schedulerId) continue;

        if (scheduler.name === UPCOMING_MATCHES_JOB_NAME && schedulerId !== UPCOMING_MATCHES_SCHEDULER_ID) {
            await notificationQueue.removeJobScheduler(schedulerId);
        }
    }

    await notificationQueue.upsertJobScheduler(
        UPCOMING_MATCHES_SCHEDULER_ID,
        {
            pattern: UPCOMING_MATCHES_CRON_PATTERN,
        },
        {
            name: UPCOMING_MATCHES_JOB_NAME,
            data: { 
                type: NotificationType.SYSTEM_UPCOMING_MATCH_CRON,
                recipientId: "system",
                traceId: "cron"
            },
            opts: {
                removeOnComplete: true,
            },
        },
    );
    
    console.log(`[Scheduler] Upcoming matches scheduler "${UPCOMING_MATCHES_SCHEDULER_ID}" set with cron "${UPCOMING_MATCHES_CRON_PATTERN}".`);
}

