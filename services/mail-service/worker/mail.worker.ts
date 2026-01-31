import { Worker } from "bullmq";
import { redisConfig } from "../config/redis";
import MailService from "../service/mail.service";
import { getEmailTemplate } from "../templates";
import { type EmailType } from "../types/mail.types";

export const mailWorker = new Worker(
    "mail-queue",
    async (job) => {
        console.log(`Processing job: ${job.name} to ${job.data.to}`);
        const mailservice = new MailService();
        // Destructure job data. 'type' should match EmailType enum values.
        // 'data' contains the dynamic values for the template (e.g. resetLink, userName).
        const { to, subject, text, data } = job.data;
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
        connection: redisConfig,
        concurrency: 50,
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