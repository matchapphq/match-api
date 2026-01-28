import Stripe from "stripe";

/**
 * Stripe Configuration
 *
 * This module initializes and exports the Stripe client instance.
 * All Stripe-related constants and helper functions are centralized here.
 */

// Validate required environment variables
if (!process.env.STRIPE_SECRET_KEY) {
    console.warn(
        "Warning: STRIPE_SECRET_KEY is not set. Stripe functionality will be disabled.",
    );
}

/**
 * Stripe client instance
 * Uses the secret key from environment variables
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-12-15.clover",
    typescript: true,
});

/**
 * Stripe Price IDs for subscription plans
 * These should be created in the Stripe Dashboard and IDs stored here
 */
export const STRIPE_PRICES = {
    // Monthly plan: €30/month
    MONTHLY: process.env.STRIPE_PRICE_MONTHLY || "",
    // Annual plan: €300/year (€25/month equivalent)
    ANNUAL: process.env.STRIPE_PRICE_ANNUAL || "",
} as const;

/**
 * Stripe Webhook Secret for verifying webhook signatures
 */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

/**
 * Frontend URLs for Stripe Checkout redirects
 */
export const CHECKOUT_URLS = {
    SUCCESS: process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL}?checkout=success`
        : "http://localhost:3001?checkout=success",
    CANCEL: process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL}?checkout=cancel`
        : "http://localhost:3001?checkout=cancel",
} as const;

/**
 * Subscription plan details
 * Used for displaying plan information and mapping to Stripe prices
 */
export const SUBSCRIPTION_PLANS = {
    monthly: {
        id: "monthly",
        name: "Mensuel",
        price: 30,
        currency: "EUR",
        interval: "month" as const,
        intervalCount: 1,
        stripePriceId: STRIPE_PRICES.MONTHLY,
        features: [
            "Diffusion illimitée de matchs",
            "Visibilité sur la plateforme Match",
            "Gestion des réservations en temps réel",
            "Statistiques détaillées",
            "Support prioritaire",
        ],
        description: "Facturation mensuelle - Sans engagement",
    },
    annual: {
        id: "annual",
        name: "Annuel",
        price: 300,
        pricePerMonth: 25,
        currency: "EUR",
        interval: "year" as const,
        intervalCount: 1,
        stripePriceId: STRIPE_PRICES.ANNUAL,
        features: [
            "Diffusion illimitée de matchs",
            "Visibilité sur la plateforme Match",
            "Gestion des réservations en temps réel",
            "Statistiques détaillées",
            "Support prioritaire",
            "Économie de 60€/an",
        ],
        description: "Facturation annuelle - Soit 25€/mois",
    },
} as const;

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
    return !!(
        process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_PRICE_MONTHLY &&
        process.env.STRIPE_PRICE_ANNUAL
    );
}

/**
 * Get plan details by plan ID
 */
export function getPlanById(planId: string) {
    if (planId === "monthly") return SUBSCRIPTION_PLANS.monthly;
    if (planId === "annual") return SUBSCRIPTION_PLANS.annual;
    return null;
}

export default stripe;
