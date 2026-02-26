import { randomUUIDv7 } from "bun";
import { mailQueue } from "../../queue/notification.queue";
import { EmailTemplate } from "../../types/jobs/notifications";
import { EmailType } from "../../types/mail.types";

export class SupportLogic {
    private static readonly DATA_EXPORT_RECIPIENT = "data@matchapp.fr";

    private static buildDataExportText(data: {
        traceId: string;
        userId: string;
        userName: string;
        userEmail: string;
        message: string;
    }): string {
        return [
            "Nouvelle demande d'export de données RGPD",
            `Trace ID: ${data.traceId}`,
            `User ID: ${data.userId}`,
            `Nom: ${data.userName}`,
            `Email: ${data.userEmail}`,
            "",
            "Message utilisateur:",
            data.message,
        ].join("\n");
    }

    async requestDataExport(data: {
        userId: string;
        userName: string;
        userEmail: string;
        message: string;
    }) {
        const traceId = randomUUIDv7();
        const subject = `[RGPD] Demande d'export - ${data.userEmail}`;
        const templateData = {
            traceId,
            userId: data.userId,
            userName: data.userName,
            userEmail: data.userEmail,
            message: data.message,
        };
        const requestText = SupportLogic.buildDataExportText(templateData);

        await mailQueue.add(EmailType.DATA_EXPORT_REQUEST, {
            to: SupportLogic.DATA_EXPORT_RECIPIENT,
            replyTo: data.userEmail,
            subject,
            text: requestText,
            data: {
                subject,
                template: EmailTemplate.DATA_EXPORT_REQUEST,
                text: requestText,
                variables: templateData,
            },
        }, {
            removeOnComplete: true,
            attempts: 3,
            backoff: {
                type: "exponential" as const,
                delay: 1000,
            },
            jobId: `${traceId}-data-export-request`,
        });

        return {
            success: true,
            message: "Data export request submitted successfully",
            traceId,
        };
    }

    async reportBug(data: {
        userName: string;
        userEmail: string;
        description: string;
        metadata?: any;
    }) {
        const adminEmail = process.env.SMTP_SEND_MAIL || 'support@matchapp.fr';
        const traceId = randomUUIDv7();
        // Queue the bug report email to the admin
        await mailQueue.add(EmailType.BUG_REPORT, {
            to: adminEmail,
            traceId,
            data: {
                subject: `[BUG REPORT] ${data.userName}`,
                template: EmailTemplate.BUG_REPORT,
                variables: {
                    userName: data.userName,
                    userEmail: data.userEmail,
                    description: data.description,
                    metadata: data.metadata || {}
                }
            }
        }, {
            removeOnComplete: true,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
            jobId: `${traceId}-bug-report`
        });

        return { 
            success: true, 
            message: "Bug report submitted successfully",
            traceId,
        };
    }
}
