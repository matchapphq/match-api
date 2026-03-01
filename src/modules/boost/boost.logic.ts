import boostRepository from "../../repository/boost.repository";
import { stripe } from "../../config/stripe";

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export class BoostLogic {
    async getAvailable(userId: string) {
        const boosts = await boostRepository.getAvailableBoosts(userId);
        return {
            count: boosts.length,
            boosts: boosts.map(b => ({
                id: b.id,
                type: b.type,
                source: b.source,
                created_at: b.created_at?.toISOString(),
            })),
        };
    }

    async getPrices() {
        const prices = await boostRepository.getActivePrices();
        
        return prices.map(p => {
            let badge: string | undefined;
            if (p.pack_type === 'pack_3') badge = 'Économisez 17%';
            if (p.pack_type === 'pack_10') badge = 'Meilleure offre';

            return {
                pack_type: p.pack_type,
                quantity: p.quantity,
                price: Number(p.price),
                unit_price: Number(p.unit_price),
                discount_percentage: p.discount_percentage,
                stripe_price_id: p.stripe_price_id,
                badge,
            };
        });
    }

    async createCheckout(userId: string, userEmail: string | undefined, data: any) {
        const { pack_type, success_url, cancel_url } = data;

        const price = await boostRepository.getPriceByPackType(pack_type);
        if (!price) {
            throw new Error("INVALID_PACK_TYPE");
        }

        const purchase = await boostRepository.createPurchase({
            user_id: userId,
            pack_type: price.pack_type,
            quantity: price.quantity,
            unit_price: String(price.unit_price),
            total_price: String(price.price),
            payment_status: 'pending',
        });

        if (!purchase) {
            throw new Error("PURCHASE_CREATION_FAILED");
        }

        const sessionParams: any = {
            mode: 'payment',
            success_url: success_url || `${FRONTEND_URL}/booster/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancel_url || `${FRONTEND_URL}/booster`,
            metadata: {
                purchase_id: purchase.id,
                user_id: userId,
                pack_type: pack_type,
                type: 'boost_purchase',
            },
        };

        if (price.stripe_price_id) {
            sessionParams.line_items = [{
                price: price.stripe_price_id,
                quantity: 1,
            }];
        } else {
            sessionParams.line_items = [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: `Pack de ${price.quantity} Boost${price.quantity > 1 ? 's' : ''} Match`,
                        description: `Boostez la visibilité de ${price.quantity} match${price.quantity > 1 ? 's' : ''}`,
                    },
                    unit_amount: Math.round(Number(price.price) * 100),
                },
                quantity: 1,
            }];
        }

        if (userEmail) {
            sessionParams.customer_email = userEmail;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        await boostRepository.updatePurchase(purchase.id, {
            stripe_session_id: session.id,
        });

        return {
            checkout_url: session.url,
            session_id: session.id,
            purchase_id: purchase.id,
        };
    }

    async activateBoost(userId: string, data: any) {
        const { boost_id, venue_match_id } = data;
        const result = await boostRepository.activateBoost(boost_id, venue_match_id, userId);

        if (!result.success) {
            throw new Error(result.error || "ACTIVATION_FAILED");
        }

        return {
            success: true,
            boost_id,
            venue_match_id,
            expires_at: result.expires_at?.toISOString(),
            message: "Boost activé avec succès",
        };
    }

    async deactivateBoost(userId: string, boostId: string) {
        const result = await boostRepository.deactivateBoost(boostId, userId);

        if (!result.success) {
            throw new Error(result.error || "DEACTIVATION_FAILED");
        }

        return {
            success: true,
            boost_id: boostId,
            message: "Boost désactivé",
        };
    }

    async getHistory(userId: string, page: number, limit: number, status: string) {
        return await boostRepository.getBoostHistory(userId, { page, limit, status });
    }

    async getAnalytics(userId: string, boostId: string) {
        const analytics = await boostRepository.getBoostAnalytics(boostId, userId);

        if (!analytics) {
            throw new Error("ANALYTICS_NOT_FOUND");
        }

        return {
            boost_id: analytics.boost_id,
            venue_match_id: analytics.venue_match_id,
            boost_started_at: analytics.boost_started_at?.toISOString(),
            boost_ended_at: analytics.boost_ended_at?.toISOString(),
            views_before_boost: analytics.views_before_boost,
            views_during_boost: analytics.views_during_boost,
            views_after_boost: analytics.views_after_boost,
            bookings_before_boost: analytics.bookings_before_boost,
            bookings_during_boost: analytics.bookings_during_boost,
            bookings_after_boost: analytics.bookings_after_boost,
            performance_score: analytics.performance_score,
            estimated_roi: analytics.estimated_roi ? Number(analytics.estimated_roi) : null,
        };
    }

    async getPurchaseHistory(userId: string, page: number, limit: number) {
        const history = await boostRepository.getUserPurchaseHistory(userId, { page, limit });

        return {
            purchases: history.purchases.map(p => ({
                id: p.id,
                pack_type: p.pack_type,
                quantity: p.quantity,
                total_price: Number(p.total_price),
                payment_status: p.payment_status,
                paid_at: p.paid_at?.toISOString(),
                created_at: p.created_at?.toISOString(),
            })),
            total: history.total,
            page: history.page,
            limit: history.limit,
        };
    }

    async getStats(userId: string) {
        return await boostRepository.getBoostStats(userId);
    }

    async getSummary(userId: string) {
        return await boostRepository.getBoostSummary(userId);
    }

    async verifyPurchase(userId: string, sessionId: string) {
        const result = await boostRepository.verifyPurchase(sessionId, userId);

        if (!result.success) {
            throw new Error(result.error || "VERIFICATION_FAILED");
        }

        const purchase = result.purchase;
        if (purchase && purchase.payment_status === 'pending') {
            try {
                const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
                
                if (stripeSession.payment_status === 'paid') {
                    const purchaseId = purchase.id;
                    await boostRepository.updatePurchase(purchaseId, {
                        payment_status: 'paid',
                        payment_intent_id: stripeSession.payment_intent as string,
                        stripe_customer_id: stripeSession.customer as string,
                        paid_at: new Date(),
                    });

                    const boostIds = await boostRepository.createBoostsFromPurchase(
                        purchaseId,
                        userId,
                        purchase.quantity,
                        'stripe_payment',
                    );

                    console.log(`Created ${boostIds.length} boosts for user ${userId} from purchase ${purchaseId} (via verify fallback)`);

                    return {
                        success: true,
                        purchase: {
                            ...purchase,
                            payment_status: 'paid',
                        },
                        boosts_created: boostIds.length,
                    };
                }
            } catch (stripeError: any) {
                console.error("Error checking Stripe session:", stripeError.message);
            }
        }

        return result;
    }

    async getBoostableMatches(userId: string, venueId: string) {
        const matches = await boostRepository.getBoostableMatches(venueId, userId);
        return { matches };
    }
}
