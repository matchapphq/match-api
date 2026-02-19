import { notificationQueue } from "../../queue/notification.queue";
import { NotificationType, EmailTemplate } from "../../types/jobs/notifications";
import { v4 as uuidv4 } from 'uuid';

export class SupportLogic {
    async reportBug(data: {
        userName: string;
        userEmail: string;
        description: string;
        metadata?: any;
    }) {
        const adminEmail = process.env.SMTP_SEND_MAIL || 'support@matchapp.fr';
        const traceId = uuidv4();

        // Queue the bug report email to the admin
        await notificationQueue.add(NotificationType.EMAIL, {
            type: NotificationType.EMAIL,
            recipientId: 'admin', // or a specific admin user ID if tracked
            traceId,
            data: {
                to: adminEmail,
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
            }
        });

        return { 
            success: true, 
            message: "Bug report submitted successfully",
            traceId 
        };
    }
}
