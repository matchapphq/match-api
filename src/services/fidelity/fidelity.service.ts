import { Hono } from "hono";
import type { HonoEnv } from "../../types/hono.types";
import FidelityController from "../../controllers/fidelity/fidelity.controller";

const fidelityService = new Hono<HonoEnv>();
const controller = new FidelityController();

// ============================================
// USER ENDPOINTS (authenticated)
// ============================================

// GET /api/fidelity/summary - Get user's fidelity summary
fidelityService.get("/summary", ...controller.getSummary);

// GET /api/fidelity/points-history - Get user's points transaction history
fidelityService.get("/points-history", ...controller.getPointsHistory);

// GET /api/fidelity/badges - Get user's badges (unlocked and locked)
fidelityService.get("/badges", ...controller.getBadges);

// GET /api/fidelity/challenges - Get user's challenges
fidelityService.get("/challenges", ...controller.getChallenges);

// GET /api/fidelity/levels - Get all available levels
fidelityService.get("/levels", ...controller.getLevels);

export default fidelityService;
