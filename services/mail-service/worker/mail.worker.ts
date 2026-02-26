import { Queue, Worker } from "bullmq";
import { redisConfig } from "../config/redis";
import { getEmailTemplate } from "../templates";
import { getDataExportRequestTemplate } from "../templates/data-export-request";
import MailService from "../service/mail.service";
import { EmailType } from "../types/mail.types";

const DEFAULT_DATA_EXPORT_EMAIL = "data@matchapp.fr";

export const mailQueue = new Queue("mail-queue", { connection: redisConfig });

export const mailWorker = new Worker("mail-queue", async (job) => {
        const mailservice = new MailService();
        let { to, subject, text, data, replyTo } = job.data;
        const templateType = (
            typeof data?.template === "string" ? data.template : job.name
        ) as EmailType;
        if (!subject && typeof data?.subject === "string") {
            subject = data.subject;
        }
        if (!text && typeof data?.text === "string") {
            text = data.text;
        }
        if (job.name as EmailType === EmailType.BUG_REPORT) {
            to = process.env.BUG_REPORT_EMAIL;
        }
        if (job.name as EmailType === EmailType.DATA_EXPORT_REQUEST) {
            to = process.env.DATA_EXPORT_EMAIL || DEFAULT_DATA_EXPORT_EMAIL;
        }
        console.log(
            `[MAIL WORKER]: Processing job: ${job.name} with id: ${job.id}`,
        );
        let html = job.data.html;

        // If a specific template type is provided, generate the HTML
        if (!html && templateType) {
            try {
                const isDataExportTemplate =
                    templateType === EmailType.DATA_EXPORT_REQUEST ||
                    job.name === EmailType.DATA_EXPORT_REQUEST ||
                    data?.template === EmailType.DATA_EXPORT_REQUEST;

                html = isDataExportTemplate
                    ? getDataExportRequestTemplate(data || {})
                    : getEmailTemplate(templateType, data || {});
            } catch (error) {
                console.warn(
                    `Template generation failed for type '${templateType}'. Falling back to simple text.`,
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
        const finalSubject = subject || "Match Notification";
        const textBody = text || data?.text || finalSubject;
        await mailservice.sendMail(to, finalSubject, textBody, html, replyTo);
    }, {
        connection: redisConfig,
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
