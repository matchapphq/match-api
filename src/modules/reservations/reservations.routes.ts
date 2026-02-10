import { Hono } from "hono";
import ReservationsController from "./reservations.controller";
import { ReservationsLogic } from "./reservations.logic";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";
import { CapacityRepository } from "../../repository/capacity.repository";
import { ReservationRepository } from "../../repository/reservation.repository";
import { WaitlistRepository } from "../../repository/waitlist.repository";

class ReservationsService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller: ReservationsController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        const capacityRepo = new CapacityRepository();
        const reservationRepo = new ReservationRepository();
        const waitlistRepo = new WaitlistRepository();
        
        const reservationsLogic = new ReservationsLogic(capacityRepo, reservationRepo, waitlistRepo);
        this.controller = new ReservationsController(reservationsLogic);

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
        this.router.post("/", ...this.controller.create);
        
        // Cancel reservation
        this.router.post("/:reservationId/cancel", ...this.controller.cancel);

        // =============================================
        // WAITLIST ROUTES
        // =============================================

        // Join waitlist
        this.router.post("/waitlist/join", ...this.controller.joinWaitlist);

        // Leave waitlist
        this.router.post("/waitlist/:waitlistId/leave", ...this.controller.leaveWaitlist);

        // Get user's waitlist
        this.router.get("/waitlist", ...this.controller.getWaitlist);

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