import Stripe from "stripe";

const LIVE_CHECK_TIMEOUT_MS = 1200;
let stripeClient: Stripe | null = null;

function hasStripeSecretConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripeClient() {
    if (stripeClient) return stripeClient;

    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2025-12-15.clover",
        typescript: true,
    });

    return stripeClient;
}

function hasDefaultPaymentMethod(customer: Stripe.Customer) {
    const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
    if (!defaultPaymentMethod) return false;

    if (typeof defaultPaymentMethod === "string") {
        return defaultPaymentMethod.length > 0;
    }

    return Boolean(defaultPaymentMethod.id);
}

async function checkCustomerPaymentMethod(stripeCustomerId: string): Promise<boolean> {
    const client = getStripeClient();

    const customer = await client.customers.retrieve(stripeCustomerId, {
        expand: ["invoice_settings.default_payment_method"],
    });

    if ("deleted" in customer && customer.deleted) {
        return false;
    }

    if (hasDefaultPaymentMethod(customer)) {
        return true;
    }

    const [cards, sepaDebits] = await Promise.all([
        client.paymentMethods.list({
            customer: stripeCustomerId,
            type: "card",
            limit: 1,
        }),
        client.paymentMethods.list({
            customer: stripeCustomerId,
            type: "sepa_debit",
            limit: 1,
        }),
    ]);

    return cards.data.length > 0 || sepaDebits.data.length > 0;
}

async function resolveWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallbackValue: T,
): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((resolve) => {
                timeoutHandle = setTimeout(() => resolve(fallbackValue), timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

export async function resolveHasPaymentMethodLive(
    stripeCustomerId: string | null | undefined,
) {
    if (!stripeCustomerId) {
        return false;
    }

    if (!hasStripeSecretConfigured()) {
        return false;
    }

    try {
        return await resolveWithTimeout(
            checkCustomerPaymentMethod(stripeCustomerId),
            LIVE_CHECK_TIMEOUT_MS,
            false,
        );
    } catch (error: any) {
        if (error?.code === "resource_missing") {
            return false;
        }

        console.warn(
            `[Billing] Live Stripe payment method check failed for customer ${stripeCustomerId}. Defaulting to no payment method.`,
            error?.message || error,
        );
        return false;
    }
}
