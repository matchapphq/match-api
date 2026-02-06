import { createFactory } from "hono/factory";
import { mailQueue, notificationQueue } from "../../queue/notification.queue";
import { NotificationType } from "../../types/jobs.type";
import { EmailType } from "../../types/mail.types";

class HealthController {
    private readonly factory = createFactory();

    public readonly health = this.factory.createHandlers(async (ctx) => {
        return ctx.text("OK");
    });

    public readonly test = this.factory.createHandlers(async (ctx) => {
        const type = (ctx.req.query("type") as string | undefined) || "all";
        const email = ctx.req.query("email") || "rafael.sapalo07@gmail.com";
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

        const sendEmail = async (
            emailType: EmailType,
            subject: string,
            data: any,
        ) => {
            await mailQueue.add(
                emailType,
                {
                    to: email,
                    subject,
                    type: emailType,
                    data,
                },
                {
                    attempts: 3,
                    backoff: { type: "exponential", delay: 2000 },
                    removeOnComplete: { age: 3600, count: 100 },
                    removeOnFail: { age: 2 * 24 * 3600, count: 1000 },
                },
            );
        };

        const tests: Record<string, () => Promise<void>> = {
            [EmailType.WELCOME]: () =>
                sendEmail(EmailType.WELCOME, "Welcome to Match!", {
                    userName: "Test User",
                    actionLink: `${frontendUrl}/discovery`,
                }),
            [EmailType.WELCOME_PARTNER]: () =>
                sendEmail(
                    EmailType.WELCOME_PARTNER,
                    "Welcome to Match Partner!",
                    {
                        userName: "Test Partner",
                        actionLink: `${frontendUrl}/dashboard`,
                    },
                ),
            [EmailType.VENUE_PAYMENT_SUCCESS]: () =>
                sendEmail(
                    EmailType.VENUE_PAYMENT_SUCCESS,
                    "Confirmation de paiement - Match",
                    {
                        userName: "Test Partner",
                        venueName: "Test Venue Bar",
                        amount: "29.99€",
                        planName: "Annuel (Pro)",
                        date: new Date().toLocaleDateString("fr-FR"),
                        invoiceUrl: "https://example.com/invoice.pdf",
                    },
                ),
            [EmailType.RESERVATION_CONFIRMATION]: () =>
                sendEmail(
                    EmailType.RESERVATION_CONFIRMATION,
                    "Confirmation de réservation",
                    {
                        userName: "Test User",
                        venueName: "The Sports Bar",
                        matchName: "PSG vs OM",
                        date: "14/07/2024",
                        time: "21:00",
                        guests: 4,
                        bookingId: "RES-TEST-123",
                        address: "123 Champs-Élysées, Paris",
                    },
                ),
            [EmailType.RESET_PASSWORD]: () =>
                sendEmail(
                    EmailType.RESET_PASSWORD,
                    "Réinitialisation de mot de passe",
                    {
                        code: "123456",
                        userName: "Test User",
                    },
                ),
        };

        if (type === "all") {
            await Promise.all(Object.values(tests).map((t) => t()));
            return ctx.json({
                message: "All test emails queued",
                recipient: email,
            });
        }

        if (type && tests[type]) {
            await tests[type]();
            return ctx.json({
                message: `Test email '${type}' queued`,
                recipient: email,
            });
        }

        return ctx.json({
            message: "Specify ?type=... or ?type=all",
            availableTypes: Object.keys(tests),
            recipient: email,
        });
    });
}

export default HealthController;
