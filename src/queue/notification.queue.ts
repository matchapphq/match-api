import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";
import type { NotificationPayload } from "../types/jobs.type";

export const notificationQueue = new Queue<NotificationPayload>("notification", { connection: redisConnection });