import type { Venue } from "../types/booking.types";

// In-memory data store for venues
export const venues: Venue[] = [
    {
        id: "v1",
        name: "Stadium Bar Paris",
        lat: 48.8566,
        lng: 2.3522,
        address: "10 Rue du Match, Paris",
        capacity: 60,
        broadcasting: ["France vs Spain - Football"],
        reservedSeatsByTime: {}
    },
    {
        id: "v2",
        name: "FastGoal Arena",
        lat: 48.858,
        lng: 2.345,
        address: "22 Rue des Sports, Paris",
        capacity: 40,
        broadcasting: ["Lakers vs Warriors - Basketball"],
        reservedSeatsByTime: {}
    }
]

export class VenueRepository {
    findById(venueId: string): Venue | undefined {
        return venues.find(v => v.id === venueId)
    }

    findAll(): Venue[] {
        return venues
    }

    getReservedSeats(venueId: string, time: string): number {
        const venue = this.findById(venueId)
        return venue?.reservedSeatsByTime[time] ?? 0
    }

    updateReservedSeats(venueId: string, time: string, seats: number): void {
        const venue = this.findById(venueId)
        if (venue) {
            venue.reservedSeatsByTime[time] = seats
        }
    }
}
