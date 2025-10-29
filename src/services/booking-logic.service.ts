import { nanoid } from "nanoid";
import type { Reservation, ReservationResult } from "../types/booking.types";
import { VenueRepository } from "../repository/venue.repository";
import { BookingRepository } from "../repository/booking.repository";
import { withVenueLock } from "../utils/venue-lock.util";

export class BookingLogicService {
    private readonly venueRepository: VenueRepository;
    private readonly bookingRepository: BookingRepository;

    constructor() {
        this.venueRepository = new VenueRepository();
        this.bookingRepository = new BookingRepository();
    }

    /**
     * Reserve seats at a venue with concurrency control
     */
    async createBooking(
        venueId: string,
        userName: string,
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
                venueId,
                userName,
                seats,
                time,
                createdAt: new Date().toISOString()
            };

            // Store the booking
            this.bookingRepository.create(reservation);

            return { ok: true, reservation };
        });
    }

    /**
     * Get all bookings for a specific user
     */
    getUserBookings(userName: string): Reservation[] {
        return this.bookingRepository.findByUserName(userName);
    }

    /**
     * Get a specific booking by ID
     */
    getBookingById(bookingId: string): Reservation | undefined {
        return this.bookingRepository.findById(bookingId);
    }

    /**
     * Update a booking
     */
    async updateBooking(
        bookingId: string,
        seats: number,
        time: string
    ): Promise<ReservationResult> {
        const existingBooking = this.bookingRepository.findById(bookingId);
        if (!existingBooking) {
            throw new Error("Booking not found");
        }

        const venue = this.venueRepository.findById(existingBooking.venueId);
        if (!venue) {
            throw new Error("Venue not found");
        }

        return withVenueLock(venue.id, async () => {
            // Remove old reservation from venue
            const oldReserved = this.venueRepository.getReservedSeats(existingBooking.venueId, existingBooking.time);
            this.venueRepository.updateReservedSeats(
                existingBooking.venueId,
                existingBooking.time,
                oldReserved - existingBooking.seats
            );

            // Check new availability
            const reserved = this.venueRepository.getReservedSeats(existingBooking.venueId, time);
            if (reserved + seats > venue.capacity) {
                // Restore old reservation
                this.venueRepository.updateReservedSeats(
                    existingBooking.venueId,
                    existingBooking.time,
                    oldReserved
                );
                return {
                    ok: false,
                    available: Math.max(0, venue.capacity - reserved)
                };
            }

            // Update venue reservation
            this.venueRepository.updateReservedSeats(existingBooking.venueId, time, reserved + seats);

            // Update booking
            const updatedBooking = this.bookingRepository.update(bookingId, { seats, time });

            return { ok: true, reservation: updatedBooking };
        });
    }

    /**
     * Cancel/delete a booking
     */
    async deleteBooking(bookingId: string): Promise<boolean> {
        const booking = this.bookingRepository.findById(bookingId);
        if (!booking) {
            return false;
        }

        return withVenueLock(booking.venueId, async () => {
            // Free up the seats
            const reserved = this.venueRepository.getReservedSeats(booking.venueId, booking.time);
            this.venueRepository.updateReservedSeats(
                booking.venueId,
                booking.time,
                reserved - booking.seats
            );

            // Delete the booking
            return this.bookingRepository.delete(bookingId);
        });
    }

    /**
     * Get all bookings (admin function)
     */
    getAllBookings(): Reservation[] {
        return this.bookingRepository.findAll();
    }
}
