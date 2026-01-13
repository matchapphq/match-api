import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import boostRepository from "../../repository/boost.repository";
import { stripe } from "../../config/stripe";

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

class BoostController {
    private readonly factory = createFactory<HonoEnv>();

    /**
     * GET /boosts/available
     * Get available boosts count and list for the current user
     */
    readonly getAvailable = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const boosts = await boostRepository.getAvailableBoosts(userId);
            return ctx.json({
                count: boosts.length,
                boosts: boosts.map(b => ({
                    id: b.id,
                    type: b.type,
                    source: b.source,
                    created_at: b.created_at?.toISOString(),
                })),
            });
        } catch (error: any) {
            console.error("Error getting available boosts:", error);
            return ctx.json({ error: "Failed to get available boosts", details: error.message }, 500);
        }
    });

    /**
     * GET /boosts/prices
     * Get boost pack prices
     */
    readonly getPrices = this.factory.createHandlers(async (ctx) => {
        try {
            const prices = await boostRepository.getActivePrices();
            
            const formattedPrices = prices.map(p => {
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

            return ctx.json({ prices: formattedPrices });
        } catch (error: any) {
            console.error("Error getting boost prices:", error);
            return ctx.json({ error: "Failed to get boost prices", details: error.message }, 500);
        }
    });

    /**
     * POST /boosts/purchase/create-checkout
     * Create a Stripe Checkout session for purchasing boosts
     */
    readonly createCheckout = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const user = ctx.get('user');

        try {
            const body = await ctx.req.json();
            const { pack_type, success_url, cancel_url } = body;

            if (!pack_type) {
                return ctx.json({ error: "pack_type is required" }, 400);
            }

            // Get price info
            const price = await boostRepository.getPriceByPackType(pack_type);
            if (!price) {
                return ctx.json({ error: "Invalid pack type" }, 400);
            }

            // Create purchase record
            const purchase = await boostRepository.createPurchase({
                user_id: userId,
                pack_type: price.pack_type,
                quantity: price.quantity,
                unit_price: String(price.unit_price),
                total_price: String(price.price),
                payment_status: 'pending',
            });

            if (!purchase) {
                return ctx.json({ error: "Failed to create purchase record" }, 500);
            }

            // Create Stripe Checkout session
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

            // Use Stripe price_id if available, otherwise create line item
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

            // Add customer email if available
            if (user.email) {
                sessionParams.customer_email = user.email;
            }

            const session = await stripe.checkout.sessions.create(sessionParams);

            // Update purchase with session ID
            await boostRepository.updatePurchase(purchase.id, {
                stripe_session_id: session.id,
            });

            return ctx.json({
                checkout_url: session.url,
                session_id: session.id,
                purchase_id: purchase.id,
            });
        } catch (error: any) {
            console.error("Error creating checkout session:", error);
            return ctx.json({ error: "Failed to create checkout session", details: error.message }, 500);
        }
    });

    /**
     * POST /boosts/activate
     * Activate a boost on a venue match
     */
    readonly activateBoost = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const body = await ctx.req.json();
            const { boost_id, venue_match_id } = body;

            if (!boost_id || !venue_match_id) {
                return ctx.json({ error: "boost_id and venue_match_id are required" }, 400);
            }

            const result = await boostRepository.activateBoost(boost_id, venue_match_id, userId);

            if (!result.success) {
                return ctx.json({ success: false, error: result.error }, 400);
            }

            return ctx.json({
                success: true,
                boost_id,
                venue_match_id,
                expires_at: result.expires_at?.toISOString(),
                message: "Boost activé avec succès",
            });
        } catch (error: any) {
            console.error("Error activating boost:", error);
            return ctx.json({ error: "Failed to activate boost", details: error.message }, 500);
        }
    });

    /**
     * POST /boosts/deactivate
     * Deactivate a boost
     */
    readonly deactivateBoost = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const body = await ctx.req.json();
            const { boost_id } = body;

            if (!boost_id) {
                return ctx.json({ error: "boost_id is required" }, 400);
            }

            const result = await boostRepository.deactivateBoost(boost_id, userId);

            if (!result.success) {
                return ctx.json({ success: false, error: result.error }, 400);
            }

            return ctx.json({
                success: true,
                boost_id,
                message: "Boost désactivé",
            });
        } catch (error: any) {
            console.error("Error deactivating boost:", error);
            return ctx.json({ error: "Failed to deactivate boost", details: error.message }, 500);
        }
    });

    /**
     * GET /boosts/history
     * Get boost usage history
     */
    readonly getHistory = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const page = parseInt(ctx.req.query('page') || '1', 10);
            const limit = parseInt(ctx.req.query('limit') || '20', 10);
            const status = ctx.req.query('status') || 'all';

            const history = await boostRepository.getBoostHistory(userId, { page, limit, status });

            return ctx.json(history);
        } catch (error: any) {
            console.error("Error getting boost history:", error);
            return ctx.json({ error: "Failed to get boost history", details: error.message }, 500);
        }
    });

    /**
     * GET /boosts/analytics/:boostId
     * Get detailed analytics for a specific boost
     */
    readonly getAnalytics = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const boostId = ctx.req.param('boostId');

        if (!boostId) {
            return ctx.json({ error: "Boost ID is required" }, 400);
        }

        try {
            const analytics = await boostRepository.getBoostAnalytics(boostId, userId);

            if (!analytics) {
                return ctx.json({ error: "Analytics not found" }, 404);
            }

            return ctx.json({
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
            });
        } catch (error: any) {
            console.error("Error getting boost analytics:", error);
            return ctx.json({ error: "Failed to get boost analytics", details: error.message }, 500);
        }
    });

    /**
     * GET /boosts/purchases
     * Get purchase history
     */
    readonly getPurchaseHistory = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const page = parseInt(ctx.req.query('page') || '1', 10);
            const limit = parseInt(ctx.req.query('limit') || '20', 10);

            const history = await boostRepository.getUserPurchaseHistory(userId, { page, limit });

            return ctx.json({
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
            });
        } catch (error: any) {
            console.error("Error getting purchase history:", error);
            return ctx.json({ error: "Failed to get purchase history", details: error.message }, 500);
        }
    });

    /**
     * GET /boosts/stats
     * Get global boost statistics
     */
    readonly getStats = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const stats = await boostRepository.getBoostStats(userId);
            return ctx.json(stats);
        } catch (error: any) {
            console.error("Error getting boost stats:", error);
            return ctx.json({ error: "Failed to get boost stats", details: error.message }, 500);
        }
    });

    /**
     * GET /boosts/summary
     * Get boost summary for dashboard
     */
    readonly getSummary = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const summary = await boostRepository.getBoostSummary(userId);
            return ctx.json(summary);
        } catch (error: any) {
            console.error("Error getting boost summary:", error);
            return ctx.json({ error: "Failed to get boost summary", details: error.message }, 500);
        }
    });

    /**
     * POST /boosts/purchase/verify
     * Verify a Stripe payment after checkout
     */
    readonly verifyPurchase = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const body = await ctx.req.json();
            const { session_id } = body;

            if (!session_id) {
                return ctx.json({ error: "session_id is required" }, 400);
            }

            const result = await boostRepository.verifyPurchase(session_id, userId);

            if (!result.success) {
                return ctx.json({ success: false, error: result.error }, 404);
            }

            return ctx.json(result);
        } catch (error: any) {
            console.error("Error verifying purchase:", error);
            return ctx.json({ error: "Failed to verify purchase", details: error.message }, 500);
        }
    });

    /**
     * GET /boosts/boostable/:venueId
     * Get matches available for boosting at a venue
     */
    readonly getBoostableMatches = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');

        if (!venueId) {
            return ctx.json({ error: "Venue ID is required" }, 400);
        }

        try {
            const matches = await boostRepository.getBoostableMatches(venueId, userId);
            return ctx.json({ matches });
        } catch (error: any) {
            console.error("Error getting boostable matches:", error);
            return ctx.json({ error: "Failed to get boostable matches", details: error.message }, 500);
        }
    });
}

export default BoostController;
