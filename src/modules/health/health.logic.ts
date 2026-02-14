import { mailQueue } from "../../queue/notification.queue";
import { EmailType } from "../../types/mail.types";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export class HealthLogic {
    async checkHealth() {
        return "OK";
    }

    async testEmails(email: string, type: string = "all") {
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
                    actionLink: `${FRONTEND_URL}/discovery`,
                }),
            [EmailType.WELCOME_PARTNER]: () =>
                sendEmail(
                    EmailType.WELCOME_PARTNER,
                    "Welcome to Match Partner!",
                    {
                        userName: "Test Partner",
                        actionLink: `${FRONTEND_URL}/dashboard`,
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
            return {
                message: "All test emails queued",
                recipient: email,
            };
        }

        if (type && tests[type]) {
            await tests[type]();
            return {
                message: `Test email '${type}' queued`,
                recipient: email,
            };
        }

        return {
            message: "Specify ?type=... or ?type=all",
            availableTypes: Object.keys(tests),
            recipient: email,
        };
    }
}
