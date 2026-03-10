import { ReservationRepository } from "../repository/reservation.repository";
import stripe from "../config/stripe";
import { db } from "../config/config.db";
import { eq, and, sql } from "drizzle-orm";

export class BillingAggregationService {
    private reservationRepo = new ReservationRepository();

    /**
     * Aggregates all unbilled check-ins and reports them to Stripe.
     * This should run on the 29th of each month.
     */
    async processMonthlyBilling() {
        console.log("[BillingAggregation] Starting monthly billing process...");
        
        // 1. Get all unbilled check-ins
        const unbilled = await this.reservationRepo.getUnbilledCheckedInReservations();
        
        if (unbilled.length === 0) {
            console.log("[BillingAggregation] No unbilled reservations found.");
            return { processed: 0 };
        }

        // 2. Group by Stripe Subscription ID
        const groups = new Map<string, {
            reservationIds: string[];
            totalGuests: number;
            ownerId: string;
        }>();

        for (const item of unbilled) {
            if (!item.stripe_subscription_id) {
                console.warn(`[BillingAggregation] No stripe_subscription_id found for owner ${item.owner_id}. Skipping reservation ${item.reservation_id}.`);
                continue;
            }

            const group = groups.get(item.stripe_subscription_id) || {
                reservationIds: [],
                totalGuests: 0,
                ownerId: item.owner_id,
            };

            group.reservationIds.push(item.reservation_id);
            group.totalGuests += (item.party_size || 0);
            groups.set(item.stripe_subscription_id, group);
        }

        let totalProcessed = 0;

        // 3. Report each group to Stripe
        for (const [subscriptionId, data] of groups.entries()) {
            try {
                console.log(`[BillingAggregation] Reporting ${data.totalGuests} guests for subscription ${subscriptionId}...`);
                
                // We need to find the subscription item ID for the "commission" product
                // For simplicity, we assume the subscription has a single item or we find the right one
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                const item = subscription.items.data.find(i => 
                    i.price.nickname === 'Match Commission' || 
                    i.metadata.type === 'commission'
                ) || subscription.items.data[0];

                if (!item) {
                    console.error(`[BillingAggregation] No subscription item found for ${subscriptionId}`);
                    continue;
                }

                // Create usage record
                await stripe.subscriptionItems.createUsageRecord(item.id, {
                    quantity: data.totalGuests,
                    timestamp: Math.floor(Date.now() / 1000),
                    action: 'increment',
                });

                // 4. Mark as billed in DB
                await this.reservationRepo.markAsBilled(data.reservationIds);
                totalProcessed += data.reservationIds.length;

                console.log(`[BillingAggregation] Successfully billed group for owner ${data.ownerId}`);

            } catch (error: any) {
                console.error(`[BillingAggregation] Failed to process subscription ${subscriptionId}:`, error.message);
            }
        }

        console.log(`[BillingAggregation] Process completed. Total reservations billed: ${totalProcessed}`);
        return { processed: totalProcessed };
    }
}
