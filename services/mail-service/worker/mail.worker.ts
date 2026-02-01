import { Worker } from "bullmq";
import { redisConfig } from "../config/redis";
import MailService from "../service/mail.service";
import { getEmailTemplate } from "../templates";
import { type EmailType } from "../types/mail.types";

export const mailWorker = new Worker("mail-queue", async (job) => {
        const mailservice = new MailService();
        const { to, subject, text, data } = job.data;
    
        console.log(`Processing job: ${job.name} with id: ${job.id}`);
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
        console.log(`Sending email to ${to}`);
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