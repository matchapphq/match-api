import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

const stripeQueue = new Queue("stripe", {
  connection: redisConnection
});
