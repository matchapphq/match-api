import { Hono } from "hono";
import ReservationsController from "../../controllers/reservations/reservations.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";

class ReservationsService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller = new ReservationsController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        // All routes require authentication
        this.router.use("/*", authMiddleware);

        // =============================================
        // USER ROUTES
        // =============================================
        
        // List user's reservations
        this.router.get("/", ...this.controller.list);
        
        // Get single reservation with QR code
        this.router.get("/:reservationId", ...this.controller.getById);
        
        // Hold a table (15 min temporary hold)
        this.router.post("/hold", ...this.controller.holdTable);
        
        // Confirm reservation from hold
        this.router.post("/confirm", ...this.controller.confirmReservation);
        
        // Cancel reservation
        this.router.post("/:reservationId/cancel", ...this.controller.cancel);

        // =============================================
        // WAITLIST ROUTES
        // =============================================
        
        // Join waitlist when no tables available
        this.router.post("/waitlist", ...this.controller.joinWaitlist);
        
        // Get user's waitlist entries
        this.router.get("/waitlist/me", ...this.controller.getWaitlist);
        
        // Leave waitlist
        this.router.delete("/waitlist/:waitlistId", ...this.controller.leaveWaitlist);

        // =============================================
        // VENUE OWNER ROUTES (QR Verification & Check-in)
        // =============================================
        
        // Verify QR code (venue owner scans user's QR)
        this.router.post("/verify-qr", ...this.controller.verifyQR);
        
        // Check-in reservation after QR verification
        this.router.post("/:reservationId/check-in", ...this.controller.checkIn);
        
        // Get all reservations for a venue match (venue owner dashboard)
        this.router.get("/venue-match/:venueMatchId", ...this.controller.getVenueReservations);
    }
}

export default ReservationsService;
