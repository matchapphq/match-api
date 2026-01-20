import Stripe from "stripe";

export interface StripeJobPayload {
    id: string;
    type: string;
    data: Stripe.Event.Data;
    created: number;
}
