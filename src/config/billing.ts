export const COMMISSION_RATE_DEFAULT = "1.15";
export const COMMISSION_RATE_CENTS = Math.round(Number(COMMISSION_RATE_DEFAULT) * 100);
const COMMISSION_RATE_OVERRIDE_ENV_KEY = "BILLING_COMMISSION_DEFAULT_RATE";

const BILLING_MODEL = "commission_per_checked_in_guest" as const;
const BILLING_CURRENCY = "EUR" as const;
const BILLING_UNIT = "guest_checked_in" as const;

function normalizeRate(rawValue: string | undefined): string | null {
    if (!rawValue) return null;

    const cleaned = rawValue.trim().replace(",", ".");
    if (!cleaned) return null;

    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;

    return parsed.toFixed(2);
}

function getDefaultRate(): string {
    return normalizeRate(process.env[COMMISSION_RATE_OVERRIDE_ENV_KEY]) || COMMISSION_RATE_DEFAULT;
}

export function getCommissionPricing() {
    const defaultRate = getDefaultRate();

    return {
        model: BILLING_MODEL,
        default_rate: defaultRate,
        currency: BILLING_CURRENCY,
        unit: BILLING_UNIT,
    };
}
