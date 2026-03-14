import { queueEmailIfAllowed } from "../../services/mail-dispatch.service";
import { EmailType } from "../../types/mail.types";
import stripe from "../../config/stripe";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export class HealthLogic {
    async checkHealth() {
        return "OK";
    }

    /**
     * Test redirecting to Stripe Billing Portal using a dummy customer
     * for verification/testing purposes without database dependency.
     */
    async testStripePaymentMethod() {
        // Create a temporary dummy customer for this test
        const customer = await stripe.customers.create({
            email: `test-${Date.now()}@example.com`,
            name: "Test User (Health Module)",
            metadata: {
                is_test: "true",
                source: "health_test_module"
            },
        });

        // Create Billing Portal Session for the dummy customer
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customer.id,
            return_url: `${FRONTEND_URL}/health`, // Redirect back to health check
        });

        return {
            portal_url: portalSession.url,
            customer_id: customer.id,
        };
    }

    /**
     * Test charging a customer off-session using a saved payment method.
     * This simulates the monthly commission collection ($1.50 per customer).
     */
    async testChargeCustomer(customerId: string, amountInCents: number = 150) {
        // 1. Find the customer's default payment method
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
        });

        if (paymentMethods.data.length === 0) {
            throw new Error("No saved card found for this customer. Please add one via the portal test first.");
        }

        const defaultPaymentMethod = paymentMethods.data[0];
        if (!defaultPaymentMethod) {
            throw new Error("No saved card found for this customer. Please add one via the portal test first.");
        }

        const paymentMethodId = defaultPaymentMethod.id;

        // 2. Create and Confirm a PaymentIntent off-session
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amountInCents,
                currency: 'eur',
                customer: customerId,
                payment_method: paymentMethodId,
                off_session: true, // Crucial: tells Stripe the user isn't present
                confirm: true,     // Attempt to charge immediately
            });

            return {
                status: paymentIntent.status,
                transaction_id: paymentIntent.id,
                amount: `${amountInCents / 100}€`,
                message: "Off-session charge successful",
            };
        } catch (err: any) {
            if (err.code === 'authentication_required') {
                // This happens if the bank requires 3D Secure verification
                return {
                    status: "requires_action",
                    client_secret: err.raw.payment_intent.client_secret,
                    message: "Customer must authenticate this specific high-risk transaction",
                };
            }
            throw err;
        }
    }

    async testEmails(email: string, type: string = "all") {
        const sendEmail = async (
            emailType: EmailType,
            subject: string,
            data: any,
        ) => {
            await queueEmailIfAllowed({
                jobName: emailType,
                isTransactional: true,
                payload: {
                    to: email,
                    subject,
                    type: emailType,
                    data,
                },
                options: {
                    attempts: 3,
                    backoff: { type: "exponential", delay: 2000 },
                    removeOnComplete: { age: 3600, count: 100 },
                    removeOnFail: { age: 2 * 24 * 3600, count: 1000 },
                },
            });
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
