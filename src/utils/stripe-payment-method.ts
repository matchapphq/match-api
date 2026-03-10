import Stripe from "stripe";

const LIVE_CHECK_TIMEOUT_MS = 1200;
let stripeClient: Stripe | null = null;

export interface MaskedPaymentMethod {
    type: string;
    brand: string | null;
    last4: string | null;
}

export interface StripePaymentMethodState {
    has_payment_method: boolean;
    payment_method?: MaskedPaymentMethod;
}

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

function toMaskedPaymentMethod(paymentMethod: Stripe.PaymentMethod): MaskedPaymentMethod {
    if (paymentMethod.type === "card" && paymentMethod.card) {
        return {
            type: "card",
            brand: paymentMethod.card.brand || null,
            last4: paymentMethod.card.last4 || null,
        };
    }

    if (paymentMethod.type === "sepa_debit" && paymentMethod.sepa_debit) {
        return {
            type: "sepa_debit",
            brand: "SEPA",
            last4: paymentMethod.sepa_debit.last4 || null,
        };
    }

    return {
        type: paymentMethod.type || "other",
        brand: null,
        last4: null,
    };
}

async function getMaskedPaymentMethod(stripeCustomerId: string): Promise<MaskedPaymentMethod | null> {
    const client = getStripeClient();

    const customer = await client.customers.retrieve(stripeCustomerId, {
        expand: ["invoice_settings.default_payment_method"],
    });

    if ("deleted" in customer && customer.deleted) {
        return null;
    }

    const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

    if (defaultPaymentMethod && typeof defaultPaymentMethod !== "string") {
        return toMaskedPaymentMethod(defaultPaymentMethod);
    }

    if (defaultPaymentMethod && typeof defaultPaymentMethod === "string") {
        const paymentMethod = await client.paymentMethods.retrieve(defaultPaymentMethod);
        if (!("deleted" in paymentMethod && paymentMethod.deleted)) {
            return toMaskedPaymentMethod(paymentMethod);
        }
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

    if (cards.data[0]) {
        return toMaskedPaymentMethod(cards.data[0]);
    }

    if (sepaDebits.data[0]) {
        return toMaskedPaymentMethod(sepaDebits.data[0]);
    }

    return null;
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
    const state = await resolvePaymentMethodStateLive(stripeCustomerId);
    return state.has_payment_method;
}

export async function resolvePaymentMethodStateLive(
    stripeCustomerId: string | null | undefined,
): Promise<StripePaymentMethodState> {
    if (!stripeCustomerId) {
        return { has_payment_method: false };
    }

    if (!hasStripeSecretConfigured()) {
        return { has_payment_method: false };
    }

    try {
        const paymentMethod = await resolveWithTimeout(
            getMaskedPaymentMethod(stripeCustomerId),
            LIVE_CHECK_TIMEOUT_MS,
            null,
        );

        if (!paymentMethod) {
            return { has_payment_method: false };
        }

        return {
            has_payment_method: true,
            payment_method: paymentMethod,
        };
    } catch (error: any) {
        if (error?.code === "resource_missing") {
            return { has_payment_method: false };
        }

        console.warn(
            `[Billing] Live Stripe payment method check failed for customer ${stripeCustomerId}. Defaulting to no payment method.`,
            error?.message || error,
        );
        return { has_payment_method: false };
    }
}
