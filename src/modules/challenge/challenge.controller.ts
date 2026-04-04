import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { challengeLogic } from "./challenge.logic";

class ChallengeController {
    private readonly factory = createFactory<HonoEnv>();

    /**
     * GET /api/challenge/status
     */
    public readonly getStatus = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const status = await challengeLogic.getStatus(user.id);
            return c.json({ data: status });
        } catch (error: any) {
            console.error("Error getting challenge status:", error);
            return c.json({ error: "Internal Server Error" }, 500);
        }
    });

    /**
     * GET /api/challenge/leaderboard
     */
    public readonly getLeaderboard = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            const leaderboard = await challengeLogic.getLeaderboard(user?.id);
            return c.json({ data: leaderboard });
        } catch (error: any) {
            console.error("Error getting leaderboard:", error);
            return c.json({ error: "Internal Server Error" }, 500);
        }
    });

    /**
     * POST /api/challenge/scan
     */
    public readonly postScan = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

            const { venueId, latitude, longitude } = await c.req.json();
            if (!venueId) return c.json({ error: "venueId is required" }, 400);

            const result = await challengeLogic.handleScan(user.id, venueId, { lat: latitude, lng: longitude });
            return c.json(result);
        } catch (error: any) {
            console.error("Error processing scan:", error);
            return c.json({ error: "Internal Server Error" }, 500);
        }
    });

    /**
     * POST /api/challenge/bug-report
     */
    public readonly postBugReport = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

            const body = await c.req.json();
            const result = await challengeLogic.submitBugReport(user.id, body);
            return c.json({ data: result });
        } catch (error: any) {
            console.error("Error submitting bug report:", error);
            return c.json({ error: "Internal Server Error" }, 500);
        }
    });

    /**
     * POST /api/challenge/venue-suggestion
     */
    public readonly postVenueSuggestion = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

            const body = await c.req.json();
            const result = await challengeLogic.submitVenueSuggestion(user.id, body);
            return c.json({ data: result });
        } catch (error: any) {
            console.error("Error submitting venue suggestion:", error);
            return c.json({ error: "Internal Server Error" }, 500);
        }
    });
}

export const challengeController = new ChallengeController();
