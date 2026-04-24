import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { NotificationType, type NotificationPayload } from "../types/jobs.type";
import { pushNotificationService } from "../services/push-notification.service";
import { triggerUpcomingMatchNotifications } from "../services/notifications/team-upcoming-match.trigger";

const notificationWorker = new Worker<NotificationPayload>("notification", async (job: Job<NotificationPayload>) => {
    const { type, data, recipientId } = job.data;
    
    switch (type) {
        case NotificationType.EMAIL:
            break;
        case NotificationType.SMS:
            break;
        case NotificationType.SYSTEM_UPCOMING_MATCH_CRON:
            await triggerUpcomingMatchNotifications();
            break;
        case NotificationType.PUSH_NOTIFICATION:
            if (data && 'tokens' in data && data.tokens.length > 0) {
                await pushNotificationService.sendNotifications(data.tokens, data.title, data.body, data.data);
            }
            break;
    }

}, { connection: redisConnection });

notificationWorker.on("completed", async (job: Job) => {
    console.log(`Job ${job.id} completed`);
});

export {
    notificationWorker,
}
