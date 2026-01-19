import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const notificationQueue = new Queue("notification", { connection: redisConnection });