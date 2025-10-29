import { nanoid } from "nanoid";
import type { Venue, CreateVenueInput, UpdateVenueInput, GameBroadcast, AddBroadcastInput } from "../types/venue.types";

// In-memory data store for venues
export const venues: Venue[] = [
    {
        id: "v1",
        name: "Stadium Bar Paris",
        lat: 48.8566,
        lng: 2.3522,
        address: "10 Rue du Match, Paris",
        capacity: 60,
        maxSimultaneousBroadcasts: 2,
        broadcasts: [
            {
                id: nanoid(),
                name: "France vs Spain - Football",
                sport: "Football",
                startTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
                endTime: new Date(Date.now() + 9000000).toISOString(), // 2.5 hours from now
                screen: 1,
            },
        ],
        reservedSeatsByTime: {},
    },
    {
        id: "v2",
        name: "FastGoal Arena",
        lat: 48.858,
        lng: 2.345,
        address: "22 Rue des Sports, Paris",
        capacity: 40,
        maxSimultaneousBroadcasts: 2,
        broadcasts: [
            {
                id: nanoid(),
                name: "Lakers vs Warriors - Basketball",
                sport: "Basketball",
                startTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
                endTime: new Date(Date.now() + 14400000).toISOString(), // 4 hours from now
                screen: 1,
            },
        ],
        reservedSeatsByTime: {},
    },
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
            maxSimultaneousBroadcasts: input.maxSimultaneousBroadcasts ?? 2,
            broadcasts: [],
            reservedSeatsByTime: {},
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

    // Add a broadcast to a venue's schedule
    addBroadcast(venueId: string, input: AddBroadcastInput): GameBroadcast | null {
        const venue = this.findById(venueId)
        if (!venue) return null

        const broadcast: GameBroadcast = {
            id: nanoid(),
            ...input,
        }

        venue.broadcasts.push(broadcast)
        return broadcast
    }

    // Remove a broadcast from a venue's schedule
    removeBroadcast(venueId: string, broadcastId: string): boolean {
        const venue = this.findById(venueId)
        if (!venue) return false

        const index = venue.broadcasts.findIndex(b => b.id === broadcastId)
        if (index === -1) return false

        venue.broadcasts.splice(index, 1)
        return true
    }

    // Update a broadcast
    updateBroadcast(venueId: string, broadcastId: string, updates: Partial<AddBroadcastInput>): GameBroadcast | null {
        const venue = this.findById(venueId)
        if (!venue) return null

        const broadcast = venue.broadcasts.find(b => b.id === broadcastId)
        if (!broadcast) return null

        Object.assign(broadcast, updates)
        return broadcast
    }

    // Get broadcasts for a venue at a specific time
    getBroadcastsAtTime(venueId: string, time: string): GameBroadcast[] {
        const venue = this.findById(venueId)
        if (!venue) return []

        const targetTime = new Date(time).getTime()
        return venue.broadcasts.filter(b => {
            const start = new Date(b.startTime).getTime()
            const end = new Date(b.endTime).getTime()
            return targetTime >= start && targetTime <= end
        })
    }

    // Get all broadcasts for a venue
    getAllBroadcasts(venueId: string): GameBroadcast[] {
        const venue = this.findById(venueId)
        return venue?.broadcasts ?? []
    }

    // Check if venue can add another broadcast at a given time
    canAddBroadcast(venueId: string, startTime: string, endTime: string): { canAdd: boolean; reason?: string } {
        const venue = this.findById(venueId)
        if (!venue) return { canAdd: false, reason: "Venue not found" }

        const start = new Date(startTime).getTime()
        const end = new Date(endTime).getTime()

        // Check for any overlapping time periods
        const overlappingBroadcasts = venue.broadcasts.filter(b => {
            const bStart = new Date(b.startTime).getTime()
            const bEnd = new Date(b.endTime).getTime()
            // Check if time ranges overlap
            return (start < bEnd && end > bStart)
        })

        if (overlappingBroadcasts.length >= venue.maxSimultaneousBroadcasts) {
            return { 
                canAdd: false, 
                reason: `Maximum ${venue.maxSimultaneousBroadcasts} simultaneous broadcasts reached for this time slot`, 
            }
        }

        return { canAdd: true }
    }
}
