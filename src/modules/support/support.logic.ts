import { randomUUIDv7 } from "bun";
import { mailQueue, notificationQueue } from "../../queue/notification.queue";
import { NotificationType, EmailTemplate } from "../../types/jobs/notifications";

export class SupportLogic {
    async reportBug(data: {
        userName: string;
        userEmail: string;
        description: string;
        metadata?: any;
    }) {
        const adminEmail = process.env.SMTP_SEND_MAIL || 'support@matchapp.fr';
        const traceId = randomUUIDv7();
        // Queue the bug report email to the admin
        await mailQueue.add("bug-report", {
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
