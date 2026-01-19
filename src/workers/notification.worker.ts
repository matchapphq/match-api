import { Worker, Job } from "bullmq";

const notificationWorker = new Worker("notification", async (job: Job) => {
  console.log(`Processing job ${job.id}`);
});

export {
    notificationWorker
}
