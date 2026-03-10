import Stripe from "stripe";

export type StripeJobType = 
    | "webhook_event"
    | "process_commission";

export interface StripeJobPayload {
    id: string;
    type: StripeJobType;
    data?: Stripe.Event;
    created: number;
    // Fields for process_commission
    commissionData?: {
        reservationId: string;
        venueOwnerId: string;
        stripeCustomerId: string;
        amountInCents: number;
        currency: string;
    };
}
