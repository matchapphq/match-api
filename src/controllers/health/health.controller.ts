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
        await mailQueue.add("reservation-confirmation", {
            to: "rafael.sapalo07@gmail.com",
            subject: "Réinitialisation de mot de passe",
            text: "This is a test email.",
            type: "reset-password",
            data: {
              userName: "Alex",
              venueName: "The Sports Bar",
              matchName: "France vs Spain",
              date: "14/07/2024",
              time: "21:00",
              guests: 4,
              bookingId: "RES-98765",
              address: "123 Main St, Paris"
            }
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
