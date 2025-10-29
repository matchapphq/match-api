export type Venue = {
    id: string
    name: string
    lat: number
    lng: number
    address: string
    capacity: number
    broadcasting: string[]
    reservedSeatsByTime: Record<string, number>
}

export type CreateVenueInput = {
    name: string
    lat: number
    lng: number
    address: string
    capacity: number
    broadcasting: string[]
}

export type UpdateVenueInput = Partial<CreateVenueInput>
