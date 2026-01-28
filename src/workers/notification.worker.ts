import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { NotificationType, type NotificationPayload } from "../types/jobs.type";

const notificationWorker = new Worker<NotificationPayload>("notification", async (job: Job<NotificationPayload>) => {
    const { type, data, recipientId } = job.data;
    
    switch (type) {
        case NotificationType.EMAIL:
            break;
        case NotificationType.SMS:
            break;
        case NotificationType.PUSH:
            break;
    }

}, { connection: redisConnection });

notificationWorker.on("completed", async (job: Job) => {
    console.log(`Job ${job.id} completed`);
});

export {
    notificationWorker,
}
