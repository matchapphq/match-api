import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { getEmailTemplate } from "../services/mail/templates";
import MailService from "../services/mail/mail.service";
import { type EmailType } from "../types/mail.types";
import { mailQueue } from "../queue/notification.queue";

export const mailWorker = new Worker("mail-queue", async (job) => {
        const mailservice = new MailService();
        const { to, subject, text, data } = job.data;

        console.log(
            `[MAIL WORKER]: Processing job: ${job.name} with id: ${job.id}`,
        );
        let html = job.data.html;

        // If a specific template type is provided, generate the HTML
        if (!html && job.name) {
            try {
                html = getEmailTemplate(job.name as EmailType, data || {});
            } catch (error) {
                console.warn(
                    `Template generation failed for type '${job.name}'. Falling back to simple text.`,
                    error,
                );
            }
        }

        // Fallback if no HTML could be generated
        if (!html) {
            html = text
                ? `<div style="font-family: sans-serif; padding: 20px;">${text.replace(/\n/g, "<br>")}</div>`
                : `<div>${subject}</div>`;
        }

        // Ensure text body exists for clients that don't support HTML
        const textBody = text || data?.text || subject;
        await mailservice.sendMail(to, subject, textBody, html);
    }, {
        connection: redisConnection,
        concurrency: 5,
        // limiter: { max: 10, duration: 1000 },
        removeOnFail: {
            age: 2 * 24 * 3600,
            count: 1000,
        },
        removeOnComplete: {
            age: 3600,
            count: 100,
        },
    },
);
