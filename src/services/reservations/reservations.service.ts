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
        
        // Create reservation (instant or request mode)
        // Backend decides PENDING vs CONFIRMED based on venue.booking_mode
        this.router.post("/", ...this.controller.create);
        
        // Cancel reservation
        this.router.post("/:reservationId/cancel", ...this.controller.cancel);

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
