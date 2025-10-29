export type Reservation = {
    id: string
    name: string
    seats: number
    time: string // ISO string
    createdAt: string
}

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

export type ReservationResult = {
    ok: boolean
    reservation?: Reservation
    available?: number
}
