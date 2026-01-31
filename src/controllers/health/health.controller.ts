import { createFactory } from "hono/factory";
import { mailQueue, notificationQueue } from "../../queue/notification.queue";
import { NotificationType } from "../../types/jobs.type";

class HealthController {
    private readonly factory = createFactory();

    public readonly health = this.factory.createHandlers(async (ctx) => {
        return ctx.text("OK");
    });

    public readonly test = this.factory.createHandlers(async (ctx) => {
        // await notificationQueue.add(
        //     "venue_owner_notify",
        //     {
        //         type: NotificationType.SMS,
        //         recipientId: "ownerId",
        //         traceId: "traceId",
        //         venueId: "venueId",
        //         data: {
        //             phone: "1234567890",
        //             message: "Test message",
        //         },
        //     },
        //     {
        //         attempts: 3,
        //         backoff: { type: "exponential", delay: 2000 },
        //         removeOnComplete: 50,
        //     },
        // );
        await mailQueue.add("test-mail", {
            from: "noreply@match.com",
            to: "test@example.com",
            subject: "Test Email",
            text: "This is a test email.",
        }, {
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: {
                age: 3600,
                count: 100,
            },
            removeOnFail: {
                age: 2 * 24 * 3600,
                count: 1000,
            },
        });
        return ctx.text("Test");
    });
}

export default HealthController;
