/**
 * Capacity Repository
 * 
 * Handles capacity-based reservations where:
 * - Venues have a total capacity (e.g., 80 people)
 * - Users book with a party size (e.g., group of 4)
 * - Each booking decrements available capacity
 * - No physical "tables" - just capacity management
 */

import { db } from "../config/config.db";
import { venueMatchesTable } from "../config/db/matches.table";
import { venuesTable } from "../config/db/venues.table";
import { eq, and, gte, sql } from "drizzle-orm";

// In-memory holds (for simplicity - in production, use Redis or a holds table)
interface CapacityHold {
    id: string;
    venueMatchId: string;
    userId: string;
    partySize: number;
    expiresAt: Date;
    createdAt: Date;
}

const activeHolds = new Map<string, CapacityHold>();

// Clean up expired holds periodically
setInterval(() => {
    const now = new Date();
    for (const [id, hold] of activeHolds) {
        if (hold.expiresAt < now) {
            activeHolds.delete(id);
            // Return capacity to venue match
            releaseHoldCapacity(hold.venueMatchId, hold.partySize).catch(console.error);
        }
    }
}, 60000); // Every minute

async function releaseHoldCapacity(venueMatchId: string, partySize: number) {
    await db.update(venueMatchesTable)
        .set({
            available_capacity: sql`${venueMatchesTable.available_capacity} + ${partySize}`,
            held_capacity: sql`${venueMatchesTable.held_capacity} - ${partySize}`,
            updated_at: new Date()
        })
        .where(eq(venueMatchesTable.id, venueMatchId));
}

export class CapacityRepository {
    private readonly HOLD_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    /**
     * Check if venue match has enough capacity for a party
     */
    async checkAvailability(venueMatchId: string, partySize: number): Promise<{
        available: boolean;
        availableCapacity: number;
        maxGroupSize: number;
        message?: string;
    }> {
        const venueMatch = await db.query.venueMatchesTable.findFirst({
            where: eq(venueMatchesTable.id, venueMatchId),
        });

        if (!venueMatch) {
            return { available: false, availableCapacity: 0, maxGroupSize: 0, message: "Venue match not found" };
        }

        if (!venueMatch.allows_reservations) {
            return { available: false, availableCapacity: venueMatch.available_capacity, maxGroupSize: venueMatch.max_group_size, message: "Reservations not allowed for this match" };
        }

        if (partySize > venueMatch.max_group_size) {
            return { 
                available: false, 
                availableCapacity: venueMatch.available_capacity, 
                maxGroupSize: venueMatch.max_group_size,
                message: `Party size exceeds maximum of ${venueMatch.max_group_size} people` 
            };
        }

        if (partySize > venueMatch.available_capacity) {
            return { 
                available: false, 
                availableCapacity: venueMatch.available_capacity, 
                maxGroupSize: venueMatch.max_group_size,
                message: `Not enough capacity. Only ${venueMatch.available_capacity} spots remaining` 
            };
        }

        return { 
            available: true, 
            availableCapacity: venueMatch.available_capacity, 
            maxGroupSize: venueMatch.max_group_size 
        };
    }

    /**
     * Create a hold on capacity (15-minute reservation window)
     * Uses atomic operation to prevent race conditions
     */
    async createHold(venueMatchId: string, userId: string, partySize: number): Promise<{
        success: boolean;
        hold?: CapacityHold;
        message?: string;
    }> {
        // Check if user already has an active hold for this venue match
        for (const hold of activeHolds.values()) {
            if (hold.userId === userId && hold.venueMatchId === venueMatchId) {
                return { success: false, message: "You already have an active hold for this match" };
            }
        }

        // Atomic: decrement available capacity only if enough exists
        const result = await db.update(venueMatchesTable)
            .set({
                available_capacity: sql`${venueMatchesTable.available_capacity} - ${partySize}`,
                held_capacity: sql`${venueMatchesTable.held_capacity} + ${partySize}`,
                updated_at: new Date()
            })
            .where(and(
                eq(venueMatchesTable.id, venueMatchId),
                gte(venueMatchesTable.available_capacity, partySize),
                eq(venueMatchesTable.allows_reservations, true)
            ))
            .returning();

        if (result.length === 0) {
            // Check why it failed
            const availability = await this.checkAvailability(venueMatchId, partySize);
            return { success: false, message: availability.message || "Unable to create hold" };
        }

        // Create hold record
        const holdId = crypto.randomUUID();
        const hold: CapacityHold = {
            id: holdId,
            venueMatchId,
            userId,
            partySize,
            expiresAt: new Date(Date.now() + this.HOLD_DURATION_MS),
            createdAt: new Date()
        };

        activeHolds.set(holdId, hold);

        return { success: true, hold };
    }

    /**
     * Get a hold by ID
     */
    getHold(holdId: string): CapacityHold | undefined {
        const hold = activeHolds.get(holdId);
        if (hold && hold.expiresAt < new Date()) {
            // Hold expired
            activeHolds.delete(holdId);
            releaseHoldCapacity(hold.venueMatchId, hold.partySize).catch(console.error);
            return undefined;
        }
        return hold;
    }

    /**
     * Confirm a hold (convert to reservation)
     * Moves capacity from held to reserved
     */
    async confirmHold(holdId: string): Promise<{
        success: boolean;
        hold?: CapacityHold;
        message?: string;
    }> {
        const hold = activeHolds.get(holdId);
        
        if (!hold) {
            return { success: false, message: "Hold not found or expired" };
        }

        if (hold.expiresAt < new Date()) {
            activeHolds.delete(holdId);
            await releaseHoldCapacity(hold.venueMatchId, hold.partySize);
            return { success: false, message: "Hold has expired" };
        }

        // Move from held to reserved
        await db.update(venueMatchesTable)
            .set({
                held_capacity: sql`${venueMatchesTable.held_capacity} - ${hold.partySize}`,
                reserved_capacity: sql`${venueMatchesTable.reserved_capacity} + ${hold.partySize}`,
                updated_at: new Date()
            })
            .where(eq(venueMatchesTable.id, hold.venueMatchId));

        // Remove hold from active holds
        activeHolds.delete(holdId);

        return { success: true, hold };
    }

    /**
     * Cancel a hold (release capacity back to available)
     */
    async cancelHold(holdId: string): Promise<boolean> {
        const hold = activeHolds.get(holdId);
        
        if (!hold) {
            return false;
        }

        await releaseHoldCapacity(hold.venueMatchId, hold.partySize);
        activeHolds.delete(holdId);

        return true;
    }

    /**
     * Release reserved capacity (when reservation is canceled)
     */
    async releaseReservedCapacity(venueMatchId: string, partySize: number): Promise<void> {
        await db.update(venueMatchesTable)
            .set({
                available_capacity: sql`${venueMatchesTable.available_capacity} + ${partySize}`,
                reserved_capacity: sql`${venueMatchesTable.reserved_capacity} - ${partySize}`,
                updated_at: new Date()
            })
            .where(eq(venueMatchesTable.id, venueMatchId));
    }

    /**
     * Get venue match details
     * Note: Uses manual join to avoid PostGIS geometry parsing issues
     */
    async getVenueMatch(venueMatchId: string) {
        const result = await db.query.venueMatchesTable.findFirst({
            where: eq(venueMatchesTable.id, venueMatchId),
            with: {
                match: true,
            }
        });

        if (!result) return null;

        // Fetch venue separately to avoid geometry parsing issues
        const venue = await db.query.venuesTable.findFirst({
            where: eq(venuesTable.id, result.venue_id),
            columns: {
                id: true,
                name: true,
                city: true,
                street_address: true,
                // Exclude: location (geometry field causes parsing issues)
            }
        });

        return {
            ...result,
            venue
        };
    }

    /**
     * Get all active holds for a user
     */
    getUserHolds(userId: string): CapacityHold[] {
        const holds: CapacityHold[] = [];
        const now = new Date();
        
        for (const hold of activeHolds.values()) {
            if (hold.userId === userId && hold.expiresAt > now) {
                holds.push(hold);
            }
        }
        
        return holds;
    }
}
