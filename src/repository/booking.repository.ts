import type { Reservation } from "../types/booking.types";

// In-memory data store for user bookings
const bookings: Reservation[] = []

export class BookingRepository {
    create(reservation: Reservation): Reservation {
        bookings.push(reservation)
        return reservation
    }

    findById(bookingId: string): Reservation | undefined {
        return bookings.find(b => b.id === bookingId)
    }

    findByUserName(userName: string): Reservation[] {
        return bookings.filter(b => b.userName === userName)
    }

    findByVenueId(venueId: string): Reservation[] {
        return bookings.filter(b => b.venueId === venueId)
    }

    findAll(): Reservation[] {
        return bookings
    }

    update(bookingId: string, updates: Partial<Reservation>): Reservation | undefined {
        const booking = this.findById(bookingId)
        if (!booking) return undefined

        Object.assign(booking, updates)
        return booking
    }

    delete(bookingId: string): boolean {
        const index = bookings.findIndex(b => b.id === bookingId)
        if (index === -1) return false
        
        bookings.splice(index, 1)
        return true
    }
}
