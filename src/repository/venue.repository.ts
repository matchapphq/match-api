import { nanoid } from "nanoid";
import type { Venue, CreateVenueInput, UpdateVenueInput } from "../types/venue.types";

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

    create(input: CreateVenueInput): Venue {
        const newVenue: Venue = {
            id: nanoid(),
            ...input,
            reservedSeatsByTime: {}
        }
        venues.push(newVenue)
        return newVenue
    }

    update(venueId: string, input: UpdateVenueInput): Venue | undefined {
        const venue = this.findById(venueId)
        if (!venue) return undefined

        Object.assign(venue, input)
        return venue
    }

    delete(venueId: string): boolean {
        const index = venues.findIndex(v => v.id === venueId)
        if (index === -1) return false
        
        venues.splice(index, 1)
        return true
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

    updateCapacity(venueId: string, capacity: number): boolean {
        const venue = this.findById(venueId)
        if (!venue) return false
        
        venue.capacity = capacity
        return true
    }

    updateBroadcasting(venueId: string, broadcasting: string[]): boolean {
        const venue = this.findById(venueId)
        if (!venue) return false
        
        venue.broadcasting = broadcasting
        return true
    }
}
