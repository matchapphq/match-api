import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { ReferralLogic } from "./referral.logic";

class ReferralController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly referralLogic: ReferralLogic) {}

    /**
     * GET /referral/code
     * Get the current user's referral code (creates one if not exists)
     */
    readonly getCode = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const result = await this.referralLogic.getCode(userId);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error getting referral code:", error);
            return ctx.json({ error: "Failed to get referral code", details: error.message }, 500);
        }
    });

    /**
     * GET /referral/stats
     * Get the current user's referral statistics
     */
    readonly getStats = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const stats = await this.referralLogic.getStats(userId);
            return ctx.json(stats);
        } catch (error: any) {
            console.error("Error getting referral stats:", error);
            return ctx.json({ error: "Failed to get referral stats", details: error.message }, 500);
        }
    });

    /**
     * GET /referral/history
     * Get the current user's referral history with pagination
     */
    readonly getHistory = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const page = parseInt(ctx.req.query('page') || '1', 10);
            const limit = parseInt(ctx.req.query('limit') || '20', 10);
            const status = ctx.req.query('status') || 'all';

            const history = await this.referralLogic.getHistory(userId, page, limit, status);
            return ctx.json(history);
        } catch (error: any) {
            console.error("Error getting referral history:", error);
            return ctx.json({ error: "Failed to get referral history", details: error.message }, 500);
        }
    });

    /**
     * POST /referral/validate
     * Validate a referral code (public endpoint for signup flow)
     */
    readonly validateCode = this.factory.createHandlers(async (ctx) => {
        try {
            const body = await ctx.req.json();
            const { referral_code } = body;

            if (!referral_code) {
                return ctx.json({ error: "referral_code is required" }, 400);
            }

            const result = await this.referralLogic.validateCode(referral_code);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error validating referral code:", error);
            return ctx.json({ error: "Failed to validate referral code", details: error.message }, 500);
        }
    });

    /**
     * POST /referral/register
     * Register a referral when a new user signs up with a code
     */
    readonly registerReferral = this.factory.createHandlers(async (ctx) => {
        try {
            const body = await ctx.req.json();
            const { referral_code, referred_user_id } = body;

            if (!referral_code || !referred_user_id) {
                return ctx.json({ error: "referral_code and referred_user_id are required" }, 400);
            }

            const result = await this.referralLogic.registerReferral(referral_code, referred_user_id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "REGISTRATION_FAILED") return ctx.json({ success: false, error: "Registration failed" }, 400);
            console.error("Error registering referral:", error);
            return ctx.json({ error: "Failed to register referral", details: error.message }, 500);
        }
    });

    /**
     * POST /referral/convert
     * Convert a referral after first payment (internal/webhook use)
     */
    readonly convertReferral = this.factory.createHandlers(async (ctx) => {
        try {
            const body = await ctx.req.json();
            const { referred_user_id } = body;

            if (!referred_user_id) {
                return ctx.json({ error: "referred_user_id is required" }, 400);
            }

            const result = await this.referralLogic.convertReferral(referred_user_id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "CONVERSION_FAILED") return ctx.json({ success: false, error: "Conversion failed" }, 400);
            console.error("Error converting referral:", error);
            return ctx.json({ error: "Failed to convert referral", details: error.message }, 500);
        }
    });

    /**
     * GET /referral/boosts
     * Get available boosts for the current user
     */
    readonly getBoosts = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const result = await this.referralLogic.getBoosts(userId);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Error getting boosts:", error);
            return ctx.json({ error: "Failed to get boosts", details: error.message }, 500);
        }
    });

    /**
     * POST /referral/boosts/:boostId/use
     * Use a boost for a venue match
     */
    readonly useBoost = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const boostId = ctx.req.param('boostId');

        if (!boostId) {
            return ctx.json({ error: "Boost ID is required" }, 400);
        }

        try {
            const body = await ctx.req.json();
            const { venue_match_id } = body;

            if (!venue_match_id) {
                return ctx.json({ error: "venue_match_id is required" }, 400);
            }

            const result = await this.referralLogic.useBoost(userId, boostId, venue_match_id);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "BOOST_USAGE_FAILED") return ctx.json({ success: false, error: "Boost usage failed" }, 400);
            console.error("Error using boost:", error);
            return ctx.json({ error: "Failed to use boost", details: error.message }, 500);
        }
    });
}

export default ReferralController;