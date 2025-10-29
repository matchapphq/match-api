import { getDistance } from "geolib";
import type { Venue, CreateVenueInput, UpdateVenueInput, GameBroadcast, AddBroadcastInput } from "../types/venue.types";
import { VenueRepository } from "../repository/venue.repository";

export class VenueManagementService {
    private readonly venueRepository: VenueRepository;

    constructor() {
        this.venueRepository = new VenueRepository();
    }

    /**
     * Find venues within a given radius from coordinates
     */
    findNearbyVenues(lat: number, lng: number, radius = 2000): Venue[] {
        const allVenues = this.venueRepository.findAll();
        return allVenues.filter(v => {
            const dist = getDistance(
                { latitude: lat, longitude: lng },
                { latitude: v.lat, longitude: v.lng },
            );
            return dist <= radius;
        });
    }

    /**
     * Get venue by ID
     */
    getVenueById(venueId: string): Venue | undefined {
        return this.venueRepository.findById(venueId);
    }

    /**
     * Get all venues
     */
    getAllVenues(): Venue[] {
        return this.venueRepository.findAll();
    }

    /**
     * Create a new venue
     */
    createVenue(input: CreateVenueInput): Venue {
        return this.venueRepository.create(input);
    }

    /**
     * Update venue details
     */
    updateVenue(venueId: string, input: UpdateVenueInput): Venue | undefined {
        return this.venueRepository.update(venueId, input);
    }

    /**
     * Delete a venue
     */
    deleteVenue(venueId: string): boolean {
        return this.venueRepository.delete(venueId);
    }

    /**
     * Update venue capacity
     */
    updateVenueCapacity(venueId: string, capacity: number): boolean {
        return this.venueRepository.updateCapacity(venueId, capacity);
    }

    /**
     * Add a game broadcast to a venue's schedule
     */
    addBroadcast(venueId: string, input: AddBroadcastInput): { success: boolean; broadcast?: GameBroadcast; error?: string } {
        // Check if venue can add another broadcast at this time
        const canAdd = this.venueRepository.canAddBroadcast(venueId, input.startTime, input.endTime);
        if (!canAdd.canAdd) {
            return { success: false, error: canAdd.reason };
        }

        const broadcast = this.venueRepository.addBroadcast(venueId, input);
        if (!broadcast) {
            return { success: false, error: "Venue not found" };
        }

        return { success: true, broadcast };
    }

    /**
     * Remove a broadcast from a venue's schedule
     */
    removeBroadcast(venueId: string, broadcastId: string): boolean {
        return this.venueRepository.removeBroadcast(venueId, broadcastId);
    }

    /**
     * Update a broadcast
     */
    updateBroadcast(venueId: string, broadcastId: string, updates: Partial<AddBroadcastInput>): GameBroadcast | null {
        return this.venueRepository.updateBroadcast(venueId, broadcastId, updates);
    }

    /**
     * Get all broadcasts for a venue
     */
    getVenueBroadcasts(venueId: string): GameBroadcast[] {
        return this.venueRepository.getAllBroadcasts(venueId);
    }

    /**
     * Get broadcasts happening at a specific time
     */
    getBroadcastsAtTime(venueId: string, time: string): GameBroadcast[] {
        return this.venueRepository.getBroadcastsAtTime(venueId, time);
    }

    /**
     * Get available seats for a venue at a specific time
     */
    getAvailableSeats(venueId: string, time: string): number | undefined {
        const venue = this.venueRepository.findById(venueId);
        if (!venue) return undefined;

        const reserved = this.venueRepository.getReservedSeats(venueId, time);
        return venue.capacity - reserved;
    }

    /**
     * Find venues broadcasting a specific sport
     */
    findVenuesBySport(sport: string, time?: string): Venue[] {
        const allVenues = this.venueRepository.findAll();
        
        return allVenues.filter(venue => {
            if (time) {
                // Filter by sport and time
                const broadcasts = this.venueRepository.getBroadcastsAtTime(venue.id, time);
                return broadcasts.some(b => b.sport.toLowerCase() === sport.toLowerCase());
            } else {
                // Filter by sport only (any time)
                return venue.broadcasts.some(b => b.sport.toLowerCase() === sport.toLowerCase());
            }
        });
    }
}
