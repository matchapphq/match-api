import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { FidelityLogic } from "./fidelity.logic";

// ============================================
// HONO CONTROLLER
// ============================================

class FidelityController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly fidelityLogic: FidelityLogic) {}

    /**
     * GET /api/fidelity/summary
     */
    public readonly getSummary = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) {
                return c.json({ error: "Unauthorized" }, 401);
            }
            const userId = user.id;

            const summary = await this.fidelityLogic.getFidelitySummary(userId);
            return c.json({ data: summary });
        } catch (error: any) {
            console.error("Error getting fidelity summary:", error);
            return c.json({ error: "Failed to get fidelity summary" }, 500);
        }
    });

    /**
     * GET /api/fidelity/points-history
     */
    public readonly getPointsHistory = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const { limit = "50", offset = "0" } = c.req.query();
            const transactions = await this.fidelityLogic.getPointsHistory(
                user.id,
                parseInt(limit),
                parseInt(offset),
            );

            const history = transactions.map((t) => ({
                id: t.id,
                date: t.created_at,
                actionKey: t.action_key,
                description: t.description,
                points: t.points,
                referenceType: t.reference_type,
            }));

            return c.json({ data: history, count: history.length });
        } catch (error: any) {
            console.error("Error getting points history:", error);
            return c.json({ error: "Failed to get points history" }, 500);
        }
    });

    /**
     * GET /api/fidelity/badges
     */
    public readonly getBadges = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const badges = await this.fidelityLogic.getUserBadges(user.id);
            return c.json({ data: badges });
        } catch (error: any) {
            console.error("Error getting badges:", error);
            return c.json({ error: "Failed to get badges" }, 500);
        }
    });

    /**
     * GET /api/fidelity/challenges
     */
    public readonly getChallenges = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const challenges = await this.fidelityLogic.getUserChallenges(user.id);
            return c.json({ data: challenges });
        } catch (error: any) {
            console.error("Error getting challenges:", error);
            return c.json({ error: "Failed to get challenges" }, 500);
        }
    });

    /**
     * GET /api/fidelity/levels
     */
    public readonly getLevels = this.factory.createHandlers(async (c) => {
        try {
            const levels = await this.fidelityLogic.getAllLevels();
            return c.json({ data: levels });
        } catch (error: any) {
            console.error("Error getting levels:", error);
            return c.json({ error: "Failed to get levels" }, 500);
        }
    });
}

export default FidelityController;