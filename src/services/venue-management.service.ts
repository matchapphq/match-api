import { getDistance } from "geolib";
import type { Venue, CreateVenueInput, UpdateVenueInput } from "../types/venue.types";
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
                { latitude: v.lat, longitude: v.lng }
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
     * Update what's being broadcasted at a venue
     */
    updateBroadcasting(venueId: string, broadcasting: string[]): boolean {
        return this.venueRepository.updateBroadcasting(venueId, broadcasting);
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
}
