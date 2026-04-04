import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import { challengeController } from "./challenge.controller";

const challengeRoutes = new Hono<HonoEnv>();

// GET /status - Get current user status
challengeRoutes.get("/status", ...challengeController.getStatus);

// GET /leaderboard - Get Top 25
challengeRoutes.get("/leaderboard", ...challengeController.getLeaderboard);

// POST /scan - QR Scan
challengeRoutes.post("/scan", ...challengeController.postScan);

// POST /bug-report - Submit a bug
challengeRoutes.post("/bug-report", ...challengeController.postBugReport);

// POST /venue-suggestion - Suggest a new venue
challengeRoutes.post("/venue-suggestion", ...challengeController.postVenueSuggestion);

export default challengeRoutes;
