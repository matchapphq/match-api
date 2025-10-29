import { Hono } from "hono";
import VenuesController from "../controllers/venues.controller";

class VenuesService {
    private readonly router = new Hono();
    private readonly venuesController = new VenuesController();

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        // Venue CRUD operations
        this.router.get("/", ...this.venuesController.getVenues); // Get all venues or nearby venues with ?lat=&lng=&radius_m=
        this.router.post("/", ...this.venuesController.createVenue); // Create a new venue
        this.router.get("/:id", ...this.venuesController.getVenue); // Get specific venue
        this.router.put("/:id", ...this.venuesController.updateVenue); // Update venue details
        this.router.delete("/:id", ...this.venuesController.deleteVenue); // Delete venue
        
        // Venue management operations
        this.router.put("/:id/capacity", ...this.venuesController.updateCapacity); // Update venue capacity
        this.router.get("/:id/availability", ...this.venuesController.getAvailability); // Get available seats at specific time
        
        // Broadcast management operations
        this.router.get("/:id/broadcasts", ...this.venuesController.getBroadcasts); // Get all broadcasts (or at specific time with ?time=)
        this.router.post("/:id/broadcasts", ...this.venuesController.addBroadcast); // Add a broadcast to schedule
        this.router.put("/:id/broadcasts/:broadcastId", ...this.venuesController.updateBroadcast); // Update a broadcast
        this.router.delete("/:id/broadcasts/:broadcastId", ...this.venuesController.removeBroadcast); // Remove a broadcast
    }

    get getRouter() {
        return this.router;
    }
}

export default VenuesService;
