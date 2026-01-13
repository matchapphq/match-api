import { db } from "../config/config.db";
import { waitlistTable } from "../config/db/waitlist.table";
import { eq, and, asc, lte } from "drizzle-orm";

export class WaitlistRepository {

    /**
     * Add user to waitlist (FIFO - position determined by created_at)
     */
    async addToWaitlist(
        userId: string,
        venueMatchId: string,
        partySize: number,
        requiresAccessibility: boolean = false
    ) {
        // Check if user already in waitlist for this match
        const existing = await db.query.waitlistTable.findFirst({
            where: and(
                eq(waitlistTable.user_id, userId),
                eq(waitlistTable.venue_match_id, venueMatchId),
                eq(waitlistTable.status, 'waiting')
            )
        });

        if (existing) {
            return { entry: existing, alreadyInQueue: true };
        }

        const [entry] = await db.insert(waitlistTable).values({
            user_id: userId,
            venue_match_id: venueMatchId,
            party_size: partySize,
            requires_accessibility: requiresAccessibility,
            status: 'waiting'
        }).returning();

        return { entry, alreadyInQueue: false };
    }

    /**
     * Get user's position in the waitlist
     */
    async getPosition(waitlistId: string): Promise<number> {
        const entry = await db.query.waitlistTable.findFirst({
            where: eq(waitlistTable.id, waitlistId)
        });

        if (!entry) return -1;

        // Count how many people are ahead (created before this entry)
        const ahead = await db.select({ id: waitlistTable.id })
            .from(waitlistTable)
            .where(and(
                eq(waitlistTable.venue_match_id, entry.venue_match_id),
                eq(waitlistTable.status, 'waiting'),
                lte(waitlistTable.created_at, entry.created_at)
            ));

        return ahead.length;
    }

    /**
     * Get next person in queue (FIFO)
     */
    async getNextInQueue(venueMatchId: string, partySize?: number, accessible?: boolean) {
        const conditions = [
            eq(waitlistTable.venue_match_id, venueMatchId),
            eq(waitlistTable.status, 'waiting')
        ];

        // If we have a specific table available, filter by compatibility
        if (partySize !== undefined) {
            conditions.push(lte(waitlistTable.party_size, partySize));
        }

        if (accessible !== undefined && accessible) {
            conditions.push(eq(waitlistTable.requires_accessibility, true));
        }

        return await db.query.waitlistTable.findFirst({
            where: and(...conditions),
            orderBy: [asc(waitlistTable.created_at)]
        });
    }

    /**
     * Notify user that a table is available (5 min to claim)
     */
    async notifyUser(waitlistId: string) {
        const notificationExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        const [updated] = await db.update(waitlistTable)
            .set({
                status: 'notified',
                notified_at: new Date(),
                notification_expires_at: notificationExpiry,
                updated_at: new Date()
            })
            .where(eq(waitlistTable.id, waitlistId))
            .returning();

        return updated;
    }

    /**
     * Mark waitlist entry as converted to reservation
     */
    async convertToReservation(waitlistId: string, reservationId: string) {
        const [updated] = await db.update(waitlistTable)
            .set({
                status: 'converted',
                reservation_id: reservationId,
                updated_at: new Date()
            })
            .where(eq(waitlistTable.id, waitlistId))
            .returning();

        return updated;
    }

    /**
     * Expire notification (user didn't claim in time)
     */
    async expireNotification(waitlistId: string) {
        const [updated] = await db.update(waitlistTable)
            .set({
                status: 'expired',
                updated_at: new Date()
            })
            .where(eq(waitlistTable.id, waitlistId))
            .returning();

        return updated;
    }

    /**
     * Remove user from waitlist
     */
    async removeFromWaitlist(waitlistId: string, userId: string) {
        const [deleted] = await db.delete(waitlistTable)
            .where(and(
                eq(waitlistTable.id, waitlistId),
                eq(waitlistTable.user_id, userId)
            ))
            .returning();

        return deleted;
    }

    /**
     * Get user's waitlist entries
     */
    async findByUserId(userId: string) {
        return await db.query.waitlistTable.findMany({
            where: and(
                eq(waitlistTable.user_id, userId),
                eq(waitlistTable.status, 'waiting')
            ),
            orderBy: [asc(waitlistTable.created_at)]
        });
    }

    /**
     * Get all waiting entries for a venue match
     */
    async findByVenueMatchId(venueMatchId: string) {
        return await db.query.waitlistTable.findMany({
            where: and(
                eq(waitlistTable.venue_match_id, venueMatchId),
                eq(waitlistTable.status, 'waiting')
            ),
            orderBy: [asc(waitlistTable.created_at)]
        });
    }

    /**
     * Get waitlist for a venue match with user details (for venue owner)
     */
    async getWaitlistForVenueMatch(venueMatchId: string, status?: string) {
        const conditions = [eq(waitlistTable.venue_match_id, venueMatchId)];
        if (status && status !== 'all') {
            conditions.push(eq(waitlistTable.status, status));
        }

        const entries = await db.select()
            .from(waitlistTable)
            .where(and(...conditions))
            .orderBy(asc(waitlistTable.created_at));

        // Calculate positions
        let position = 1;
        return entries.map(entry => ({
            ...entry,
            position: entry.status === 'waiting' ? position++ : null,
        }));
    }

    /**
     * Get total party size of waiting entries
     */
    async getTotalWaitingPartySize(venueMatchId: string): Promise<number> {
        const entries = await db.select({ party_size: waitlistTable.party_size })
            .from(waitlistTable)
            .where(and(
                eq(waitlistTable.venue_match_id, venueMatchId),
                eq(waitlistTable.status, 'waiting')
            ));

        return entries.reduce((sum, e) => sum + e.party_size, 0);
    }

    /**
     * Manually notify a waitlist entry with custom expiry
     */
    async notifyUserManually(waitlistId: string, expiryMinutes: number = 60) {
        const entry = await db.query.waitlistTable.findFirst({
            where: eq(waitlistTable.id, waitlistId)
        });

        if (!entry) {
            return { success: false, error: "Waitlist entry not found" };
        }

        if (entry.status === 'notified') {
            return { success: false, error: "Customer already notified", notified_at: entry.notified_at };
        }

        if (entry.status !== 'waiting') {
            return { success: false, error: "Cannot notify non-waiting entry" };
        }

        const notificationExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000);

        const [updated] = await db.update(waitlistTable)
            .set({
                status: 'notified',
                notified_at: new Date(),
                notification_expires_at: notificationExpiry,
                updated_at: new Date()
            })
            .where(eq(waitlistTable.id, waitlistId))
            .returning();

        return {
            success: true,
            waitlistEntry: updated,
            notifications_sent: {
                email: entry.notification_method === 'email' || entry.notification_method === 'all',
                sms: entry.notification_method === 'sms' || entry.notification_method === 'all',
                push: entry.notification_method === 'push' || entry.notification_method === 'all',
            },
        };
    }

    /**
     * Find waitlist entry by ID
     */
    async findById(waitlistId: string) {
        return await db.query.waitlistTable.findFirst({
            where: eq(waitlistTable.id, waitlistId)
        });
    }

    /**
     * Clean up expired notifications (return them to waiting or expire)
     */
    async cleanupExpiredNotifications() {
        const now = new Date();

        // Find expired notifications
        const expired = await db.select()
            .from(waitlistTable)
            .where(and(
                eq(waitlistTable.status, 'notified'),
                lte(waitlistTable.notification_expires_at, now)
            ));

        // Move them back to waiting (give them another chance) or expire
        for (const entry of expired) {
            await db.update(waitlistTable)
                .set({
                    status: 'waiting', // Or 'expired' if you want stricter policy
                    notified_at: null,
                    notification_expires_at: null,
                    updated_at: new Date()
                })
                .where(eq(waitlistTable.id, entry.id));
        }

        return expired.length;
    }
}
