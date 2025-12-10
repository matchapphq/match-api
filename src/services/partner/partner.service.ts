import { Hono } from "hono";
import PartnerController from "../../controllers/partner/partner.controller";

/**
 * Service for defining Partner (Restaurant Owner) routes.
 * Mounts the PartnerController handlers to the router.
 */
class PartnerService {
    private readonly router = new Hono();
    private readonly controller = new PartnerController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.get("/venues", ...this.controller.getMyVenues);
        this.router.post("/venues", ...this.controller.createVenue);
        this.router.post("/venues/:venueId/matches", ...this.controller.scheduleMatch);
        this.router.delete("/venues/:venueId/matches/:matchId", ...this.controller.cancelMatch);
    }
}

export default PartnerService;
