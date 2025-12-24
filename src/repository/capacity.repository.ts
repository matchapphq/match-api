/**
 * Capacity Repository
 * 
 * Handles capacity-based reservations where:
 * - Venues have a total capacity (e.g., 80 people)
 * - Users book with a party size (e.g., group of 4)
 * - Each booking decrements available capacity
 * - No physical "tables" - just capacity management
 * 
 * Capacity Formula:
 *   available = total - reserved - held - blocked
 */

import { db } from "../config/config.db";
import { venueMatchesTable } from "../config/db/matches.table";
import { venuesTable } from "../config/db/venues.table";
import { eq, and, gte, sql } from "drizzle-orm";

// ============================================
// TYPES
// ============================================

export interface CapacityHold {
    id: string;
    venueMatchId: string;
    userId: string;
    partySize: number;
    expiresAt: Date;
    createdAt: Date;
}

export interface CapacityStats {
    total: number;
    available: number;
    reserved: number;
    held: number;
    blocked: number;
    occupied: number;      // reserved + held (people who will show up)
    utilizationPct: number; // (occupied / total) * 100
}

// ============================================
// IN-MEMORY HOLD STORE
// For production at scale, use Redis instead
// ============================================

const activeHolds = new Map<string, CapacityHold>();

// Simple in-memory cache for capacity stats (TTL: 5 seconds)
interface CacheEntry {
    data: CapacityStats;
    expiresAt: number;
}
const capacityCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000; // 5 seconds

// ============================================
// HOLD CLEANUP (runs every 10 seconds)
// ============================================

const HOLD_CLEANUP_INTERVAL_MS = 10000; // 10 seconds
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startHoldCleanup() {
    if (cleanupInterval) return;
    
    cleanupInterval = setInterval(() => {
        const now = new Date();
        const expiredHolds: CapacityHold[] = [];
        
        for (const [id, hold] of activeHolds) {
            if (hold.expiresAt < now) {
                expiredHolds.push(hold);
                activeHolds.delete(id);
            }
        }
        
        // Batch release expired holds
        for (const hold of expiredHolds) {
            releaseHoldCapacity(hold.venueMatchId, hold.partySize).catch(console.error);
        }
        
        // Clear expired cache entries
        const nowMs = Date.now();
        for (const [key, entry] of capacityCache) {
            if (entry.expiresAt < nowMs) {
                capacityCache.delete(key);
            }
        }
    }, HOLD_CLEANUP_INTERVAL_MS);
}

// Start cleanup on module load
startHoldCleanup();

// ============================================
// HELPER FUNCTIONS
// ============================================

async function releaseHoldCapacity(venueMatchId: string, partySize: number) {
    await db.update(venueMatchesTable)
        .set({
            available_capacity: sql`${venueMatchesTable.available_capacity} + ${partySize}`,
            held_capacity: sql`GREATEST(0, ${venueMatchesTable.held_capacity} - ${partySize})`,
            updated_at: new Date()
        })
        .where(eq(venueMatchesTable.id, venueMatchId));
    
    // Invalidate cache
    capacityCache.delete(venueMatchId);
}

export class CapacityRepository {
    private readonly HOLD_DURATION_MS = 5 * 60 * 1000; // 5 minutes (per requirements)

    // ============================================
    // HELPER FUNCTIONS - Capacity Calculations
    // ============================================

    /**
     * Get capacity stats with caching (performance optimized)
     * Cache TTL: 5 seconds
     */
    async getCapacityStats(venueMatchId: string, skipCache = false): Promise<CapacityStats | null> {
        // Check cache first
        if (!skipCache) {
            const cached = capacityCache.get(venueMatchId);
            if (cached && cached.expiresAt > Date.now()) {
                return cached.data;
            }
        }

        const venueMatch = await db.query.venueMatchesTable.findFirst({
            where: eq(venueMatchesTable.id, venueMatchId),
            columns: {
                total_capacity: true,
                available_capacity: true,
                reserved_capacity: true,
                held_capacity: true,
                blocked_capacity: true,
            }
        });

        if (!venueMatch) return null;

        const stats: CapacityStats = {
            total: venueMatch.total_capacity,
            available: venueMatch.available_capacity,
            reserved: venueMatch.reserved_capacity ?? 0,
            held: venueMatch.held_capacity ?? 0,
            blocked: venueMatch.blocked_capacity ?? 0,
            occupied: (venueMatch.reserved_capacity ?? 0) + (venueMatch.held_capacity ?? 0),
            utilizationPct: venueMatch.total_capacity > 0 
                ? Math.round(((venueMatch.reserved_capacity ?? 0) + (venueMatch.held_capacity ?? 0)) / venueMatch.total_capacity * 100)
                : 0
        };

        // Cache the result
        capacityCache.set(venueMatchId, {
            data: stats,
            expiresAt: Date.now() + CACHE_TTL_MS
        });

        return stats;
    }

    /**
     * Get available capacity (quick helper)
     */
    async getAvailableCapacity(venueMatchId: string): Promise<number> {
        const stats = await this.getCapacityStats(venueMatchId);
        return stats?.available ?? 0;
    }

    /**
     * Get occupied capacity (reserved + held)
     */
    async getOccupiedCapacity(venueMatchId: string): Promise<number> {
        const stats = await this.getCapacityStats(venueMatchId);
        return stats?.occupied ?? 0;
    }

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
     * Create a hold on capacity (5-minute reservation window)
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
        // This prevents race conditions - only one request can succeed
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

        // Invalidate cache after successful update
        capacityCache.delete(venueMatchId);

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

        // Move from held to reserved (atomic)
        await db.update(venueMatchesTable)
            .set({
                held_capacity: sql`GREATEST(0, ${venueMatchesTable.held_capacity} - ${hold.partySize})`,
                reserved_capacity: sql`${venueMatchesTable.reserved_capacity} + ${hold.partySize}`,
                updated_at: new Date()
            })
            .where(eq(venueMatchesTable.id, hold.venueMatchId));

        // Invalidate cache
        capacityCache.delete(hold.venueMatchId);

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
                reserved_capacity: sql`GREATEST(0, ${venueMatchesTable.reserved_capacity} - ${partySize})`,
                updated_at: new Date()
            })
            .where(eq(venueMatchesTable.id, venueMatchId));
        
        // Invalidate cache
        capacityCache.delete(venueMatchId);
    }

    // ============================================
    // BLOCKED CAPACITY MANAGEMENT (Venue Owner)
    // ============================================

    /**
     * Block capacity (venue owner only)
     * Used for VIP sections, maintenance, staff areas, etc.
     */
    async blockCapacity(venueMatchId: string, amount: number): Promise<{
        success: boolean;
        message?: string;
    }> {
        // Atomic: only block if enough available capacity
        const result = await db.update(venueMatchesTable)
            .set({
                available_capacity: sql`${venueMatchesTable.available_capacity} - ${amount}`,
                blocked_capacity: sql`${venueMatchesTable.blocked_capacity} + ${amount}`,
                updated_at: new Date()
            })
            .where(and(
                eq(venueMatchesTable.id, venueMatchId),
                gte(venueMatchesTable.available_capacity, amount)
            ))
            .returning();

        if (result.length === 0) {
            return { success: false, message: "Not enough available capacity to block" };
        }

        // Invalidate cache
        capacityCache.delete(venueMatchId);

        return { success: true };
    }

    /**
     * Unblock capacity (venue owner only)
     */
    async unblockCapacity(venueMatchId: string, amount: number): Promise<{
        success: boolean;
        message?: string;
    }> {
        // Atomic: only unblock if enough blocked capacity
        const result = await db.update(venueMatchesTable)
            .set({
                available_capacity: sql`${venueMatchesTable.available_capacity} + ${amount}`,
                blocked_capacity: sql`GREATEST(0, ${venueMatchesTable.blocked_capacity} - ${amount})`,
                updated_at: new Date()
            })
            .where(and(
                eq(venueMatchesTable.id, venueMatchId),
                gte(venueMatchesTable.blocked_capacity, amount)
            ))
            .returning();

        if (result.length === 0) {
            return { success: false, message: "Not enough blocked capacity to unblock" };
        }

        // Invalidate cache
        capacityCache.delete(venueMatchId);

        return { success: true };
    }

    /**
     * Set exact blocked capacity (venue owner only)
     * Recalculates available capacity based on total
     */
    async setBlockedCapacity(venueMatchId: string, blockedAmount: number): Promise<{
        success: boolean;
        message?: string;
    }> {
        const stats = await this.getCapacityStats(venueMatchId, true);
        if (!stats) {
            return { success: false, message: "Venue match not found" };
        }

        // Calculate new available: total - reserved - held - newBlocked
        const newAvailable = stats.total - stats.reserved - stats.held - blockedAmount;

        if (newAvailable < 0) {
            return { 
                success: false, 
                message: `Cannot block ${blockedAmount}. Would result in negative availability. Max blockable: ${stats.total - stats.reserved - stats.held}` 
            };
        }

        await db.update(venueMatchesTable)
            .set({
                available_capacity: newAvailable,
                blocked_capacity: blockedAmount,
                updated_at: new Date()
            })
            .where(eq(venueMatchesTable.id, venueMatchId));

        // Invalidate cache
        capacityCache.delete(venueMatchId);

        return { success: true };
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
