export type Reservation = {
    id: string
    venueId: string
    userName: string
    seats: number
    time: string // ISO string
    createdAt: string
}

export type ReservationResult = {
    ok: boolean
    reservation?: Reservation
    available?: number
}
