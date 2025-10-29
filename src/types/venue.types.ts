export type GameBroadcast = {
    id: string
    name: string // e.g., "France vs Spain - Football"
    sport: string // e.g., "Football", "Basketball", "Tennis"
    startTime: string // ISO string
    endTime: string // ISO string
    screen?: number // Optional: which screen/area (1 or 2 for now)
}

export type Venue = {
    id: string
    name: string
    lat: number
    lng: number
    address: string
    capacity: number
    maxSimultaneousBroadcasts: number // Max 2 for now
    broadcasts: GameBroadcast[] // Time-based game schedule
    reservedSeatsByTime: Record<string, number>
}

export type CreateVenueInput = {
    name: string
    lat: number
    lng: number
    address: string
    capacity: number
    maxSimultaneousBroadcasts?: number // Default to 2
}

export type UpdateVenueInput = Partial<CreateVenueInput>

export type AddBroadcastInput = {
    name: string
    sport: string
    startTime: string
    endTime: string
    screen?: number
}
