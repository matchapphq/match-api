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
    city: string
    country: string
    postalCode: string
    capacity: number
    maxSimultaneousBroadcasts: number // Max 2 for now
    broadcasts: GameBroadcast[] // Time-based game schedule
    reservedSeatsByTime: Record<string, number>
}

export type BookingMode = "INSTANT" | "REQUEST";

export type CreateVenueInput = {
    name: string
    lat: number
    lng: number
    address: string
    city?: string
    country?: string
    postalCode?: string
    capacity: number
    maxSimultaneousBroadcasts?: number // Default to 2
    type?: "bar" | "restaurant" | "fast_food" | "nightclub" | "cafe" | "lounge" | "pub" | "sports_bar"
    description?: string
    phone?: string
    email?: string
    website?: string
    booking_mode?: BookingMode // INSTANT = auto confirm, REQUEST = owner must confirm
    photos?: {
        url: string
        altText?: string
        isPrimary?: boolean
    }[]
}

export type UpdateVenueInput = Partial<CreateVenueInput>

export type AddBroadcastInput = {
    name: string
    sport: string
    startTime: string
    endTime: string
    screen?: number
}

export interface GetVenuesQuery {
    page?: number;
    limit?: number;
    city?: string;
    type?: string;
    is_verified?: boolean;
    search?: string;
    lat?: number;
    lng?: number;
    distance_km?: number;
    sort?: 'distance' | 'rating' | 'newest';
}
