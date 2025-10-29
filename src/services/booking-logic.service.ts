import { nanoid } from "nanoid";
import { getDistance } from "geolib";
import type { Reservation, Venue, ReservationResult } from "../types/booking.types";
import { VenueRepository } from "../repository/venue.repository";
import { withVenueLock } from "../utils/venue-lock.util";

export class BookingLogicService {
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
     * Reserve seats at a venue with concurrency control
     */
    async reserveSeats(
        venueId: string,
        name: string,
        seats: number,
        time: string
    ): Promise<ReservationResult> {
        const venue = this.venueRepository.findById(venueId);
        if (!venue) {
            throw new Error("Venue not found");
        }

        return withVenueLock(venue.id, async () => {
            const reserved = this.venueRepository.getReservedSeats(venueId, time);
            
            // Check if there are enough seats available
            if (reserved + seats > venue.capacity) {
                return {
                    ok: false,
                    available: Math.max(0, venue.capacity - reserved)
                };
            }

            // Update reserved seats
            this.venueRepository.updateReservedSeats(venueId, time, reserved + seats);

            // Create reservation
            const reservation: Reservation = {
                id: nanoid(),
                name,
                seats,
                time,
                createdAt: new Date().toISOString()
            };

            return { ok: true, reservation };
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
}
