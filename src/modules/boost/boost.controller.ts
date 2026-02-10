import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { BoostLogic } from "./boost.logic";

class BoostController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly boostLogic: BoostLogic) {}

    /**
     * GET /boosts/available
     * Get available boosts count and list for the current user
     */
    readonly getAvailable = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const result = await this.boostLogic.getAvailable(userId);
            return ctx.json(result);
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
            const prices = await this.boostLogic.getPrices();
            return ctx.json({ prices });
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
            const { pack_type } = body;

            if (!pack_type) {
                return ctx.json({ error: "pack_type is required" }, 400);
            }

            const result = await this.boostLogic.createCheckout(userId, user.email, body);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "INVALID_PACK_TYPE") return ctx.json({ error: "Invalid pack type" }, 400);
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

            const result = await this.boostLogic.activateBoost(userId, body);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "ACTIVATION_FAILED") return ctx.json({ error: "Activation failed" }, 400);
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

            const result = await this.boostLogic.deactivateBoost(userId, boost_id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "DEACTIVATION_FAILED") return ctx.json({ error: "Deactivation failed" }, 400);
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

            const history = await this.boostLogic.getHistory(userId, page, limit, status);
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
            const analytics = await this.boostLogic.getAnalytics(userId, boostId);
            return ctx.json(analytics);
        } catch (error: any) {
            if (error.message === "ANALYTICS_NOT_FOUND") return ctx.json({ error: "Analytics not found" }, 404);
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

            const history = await this.boostLogic.getPurchaseHistory(userId, page, limit);
            return ctx.json(history);
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
            const stats = await this.boostLogic.getStats(userId);
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
            const summary = await this.boostLogic.getSummary(userId);
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

            const result = await this.boostLogic.verifyPurchase(userId, session_id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "VERIFICATION_FAILED") return ctx.json({ error: "Verification failed" }, 404);
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
            const result = await this.boostLogic.getBoostableMatches(userId, venueId);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error getting boostable matches:", error);
            return ctx.json({ error: "Failed to get boostable matches", details: error.message }, 500);
        }
    });
}

export default BoostController;