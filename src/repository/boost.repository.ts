import { db } from "../config/config.db";
import { boostsTable, type Boost, type NewBoost } from "../config/db/referral.table";
import { 
    boostPurchasesTable, 
    boostPricesTable, 
    boostAnalyticsTable,
    type BoostPurchase,
    type NewBoostPurchase,
    type BoostPrice,
    type BoostAnalytics,
    type NewBoostAnalytics
} from "../config/db/boost.table";
import { venueMatchesTable } from "../config/db/matches.table";
import { matchesTable } from "../config/db/matches.table";
import { teamsTable } from "../config/db/sports.table";
import { eq, and, sql, desc, inArray, lt } from "drizzle-orm";

export class BoostRepository {

    // ============================================
    // BOOST PRICES
    // ============================================

    async getActivePrices(): Promise<BoostPrice[]> {
        return await db.select()
            .from(boostPricesTable)
            .where(eq(boostPricesTable.active, true))
            .orderBy(boostPricesTable.quantity);
    }

    async getPriceByPackType(packType: string): Promise<BoostPrice | null> {
        const result = await db.select()
            .from(boostPricesTable)
            .where(and(
                eq(boostPricesTable.pack_type, packType),
                eq(boostPricesTable.active, true)
            ))
            .limit(1);
        return result[0] ?? null;
    }

    // ============================================
    // BOOST PURCHASES
    // ============================================

    async createPurchase(data: NewBoostPurchase): Promise<BoostPurchase | null> {
        const result = await db.insert(boostPurchasesTable)
            .values(data)
            .returning();
        return result[0] ?? null;
    }

    async getPurchaseById(purchaseId: string): Promise<BoostPurchase | null> {
        const result = await db.select()
            .from(boostPurchasesTable)
            .where(eq(boostPurchasesTable.id, purchaseId))
            .limit(1);
        return result[0] ?? null;
    }

    async getPurchaseByPaymentIntent(paymentIntentId: string): Promise<BoostPurchase | null> {
        const result = await db.select()
            .from(boostPurchasesTable)
            .where(eq(boostPurchasesTable.payment_intent_id, paymentIntentId))
            .limit(1);
        return result[0] ?? null;
    }

    async updatePurchase(purchaseId: string, data: Partial<BoostPurchase>) {
        await db.update(boostPurchasesTable)
            .set({ ...data, updated_at: new Date() })
            .where(eq(boostPurchasesTable.id, purchaseId));
    }

    async getUserPurchaseHistory(userId: string, options: { page?: number; limit?: number } = {}) {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const offset = (page - 1) * limit;

        const purchases = await db.select()
            .from(boostPurchasesTable)
            .where(eq(boostPurchasesTable.user_id, userId))
            .orderBy(desc(boostPurchasesTable.created_at))
            .limit(limit)
            .offset(offset);

        const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(boostPurchasesTable)
            .where(eq(boostPurchasesTable.user_id, userId));

        return {
            purchases,
            total: Number(countResult[0]?.count) || 0,
            page,
            limit,
        };
    }

    // ============================================
    // BOOSTS - Core Operations
    // ============================================

    async getAvailableBoosts(userId: string): Promise<Boost[]> {
        return await db.select()
            .from(boostsTable)
            .where(and(
                eq(boostsTable.user_id, userId),
                eq(boostsTable.status, 'available')
            ))
            .orderBy(desc(boostsTable.created_at));
    }

    async getAvailableBoostsCount(userId: string): Promise<number> {
        const result = await db.select({ count: sql<number>`count(*)` })
            .from(boostsTable)
            .where(and(
                eq(boostsTable.user_id, userId),
                eq(boostsTable.status, 'available')
            ));
        return Number(result[0]?.count) || 0;
    }

    async getBoostById(boostId: string): Promise<Boost | null> {
        const result = await db.select()
            .from(boostsTable)
            .where(eq(boostsTable.id, boostId))
            .limit(1);
        return result[0] ?? null;
    }

    async createBoostsFromPurchase(
        purchaseId: string,
        userId: string,
        quantity: number,
        source: string = 'stripe_payment'
    ): Promise<string[]> {
        const boostIds: string[] = [];

        for (let i = 0; i < quantity; i++) {
            const result = await db.insert(boostsTable).values({
                user_id: userId,
                type: 'purchased',
                status: 'available',
                source,
                purchase_id: purchaseId,
            }).returning({ id: boostsTable.id });

            if (result[0]) {
                boostIds.push(result[0].id);
            }
        }

        return boostIds;
    }

    // ============================================
    // BOOST ACTIVATION/DEACTIVATION
    // ============================================

    async activateBoost(
        boostId: string,
        venueMatchId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string; expires_at?: Date }> {
        // Verify boost exists and is available
        const boost = await db.select()
            .from(boostsTable)
            .where(and(
                eq(boostsTable.id, boostId),
                eq(boostsTable.user_id, userId),
                eq(boostsTable.status, 'available')
            ))
            .limit(1);

        if (!boost[0]) {
            return { success: false, error: 'Boost not found or not available' };
        }

        // Get venue match with match details
        const venueMatch = await db.select({
            id: venueMatchesTable.id,
            venue_id: venueMatchesTable.venue_id,
            match_id: venueMatchesTable.match_id,
            is_boosted: venueMatchesTable.is_boosted,
            scheduled_at: matchesTable.scheduled_at,
            status: matchesTable.status,
        })
            .from(venueMatchesTable)
            .innerJoin(matchesTable, eq(venueMatchesTable.match_id, matchesTable.id))
            .where(eq(venueMatchesTable.id, venueMatchId))
            .limit(1);

        if (!venueMatch[0]) {
            return { success: false, error: 'Venue match not found' };
        }

        const vm = venueMatch[0];

        // Check if match is already boosted
        if (vm.is_boosted) {
            return { success: false, error: 'Match is already boosted' };
        }

        // Check if match is upcoming
        if (vm.status !== 'scheduled') {
            return { success: false, error: 'Can only boost scheduled matches' };
        }

        // Calculate expiration (match end time + 2 hours buffer)
        const expiresAt = new Date(vm.scheduled_at.getTime() + 2 * 60 * 60 * 1000);

        // Activate the boost
        await db.update(boostsTable)
            .set({
                status: 'used',
                venue_match_id: venueMatchId,
                activated_at: new Date(),
                used_at: new Date(),
                expires_at: expiresAt,
                updated_at: new Date(),
            })
            .where(eq(boostsTable.id, boostId));

        // Update the venue match
        await db.update(venueMatchesTable)
            .set({
                is_boosted: true,
                boost_id: boostId,
                boosted_at: new Date(),
                boost_expires_at: expiresAt,
                updated_at: new Date(),
            })
            .where(eq(venueMatchesTable.id, venueMatchId));

        // Create analytics record
        await db.insert(boostAnalyticsTable).values({
            boost_id: boostId,
            venue_match_id: venueMatchId,
            user_id: userId,
            boost_started_at: new Date(),
        });

        return { success: true, expires_at: expiresAt };
    }

    async deactivateBoost(
        boostId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        // Get the boost
        const boost = await db.select()
            .from(boostsTable)
            .where(and(
                eq(boostsTable.id, boostId),
                eq(boostsTable.user_id, userId),
                eq(boostsTable.status, 'used')
            ))
            .limit(1);

        if (!boost[0]) {
            return { success: false, error: 'Boost not found or not active' };
        }

        const boostRecord = boost[0];

        // Mark boost as used (already was used status, just update used_at)
        await db.update(boostsTable)
            .set({
                used_at: new Date(),
                updated_at: new Date(),
            })
            .where(eq(boostsTable.id, boostId));

        // Update the venue match if exists
        if (boostRecord.venue_match_id) {
            await db.update(venueMatchesTable)
                .set({
                    is_boosted: false,
                    boost_id: null,
                    boost_expires_at: null,
                    updated_at: new Date(),
                })
                .where(eq(venueMatchesTable.id, boostRecord.venue_match_id));
        }

        // Update analytics
        await db.update(boostAnalyticsTable)
            .set({
                boost_ended_at: new Date(),
                updated_at: new Date(),
            })
            .where(eq(boostAnalyticsTable.boost_id, boostId));

        return { success: true };
    }

    // ============================================
    // BOOST HISTORY
    // ============================================

    async getBoostHistory(
        userId: string,
        options: { page?: number; limit?: number; status?: string } = {}
    ) {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const offset = (page - 1) * limit;

        const boosts = await db.select({
            id: boostsTable.id,
            type: boostsTable.type,
            status: boostsTable.status,
            source: boostsTable.source,
            venue_match_id: boostsTable.venue_match_id,
            activated_at: boostsTable.activated_at,
            used_at: boostsTable.used_at,
            expires_at: boostsTable.expires_at,
            created_at: boostsTable.created_at,
            home_team: teamsTable.name,
        })
            .from(boostsTable)
            .leftJoin(venueMatchesTable, eq(boostsTable.venue_match_id, venueMatchesTable.id))
            .leftJoin(matchesTable, eq(venueMatchesTable.match_id, matchesTable.id))
            .leftJoin(teamsTable, eq(matchesTable.home_team_id, teamsTable.id))
            .where(eq(boostsTable.user_id, userId))
            .orderBy(desc(boostsTable.created_at))
            .limit(limit)
            .offset(offset);

        const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(boostsTable)
            .where(eq(boostsTable.user_id, userId));

        return {
            boosts,
            total: Number(countResult[0]?.count) || 0,
            page,
            limit,
        };
    }

    // ============================================
    // BOOST ANALYTICS
    // ============================================

    async getBoostAnalytics(boostId: string, userId: string): Promise<BoostAnalytics | null> {
        const result = await db.select()
            .from(boostAnalyticsTable)
            .where(and(
                eq(boostAnalyticsTable.boost_id, boostId),
                eq(boostAnalyticsTable.user_id, userId)
            ))
            .limit(1);
        return result[0] ?? null;
    }

    async updateBoostAnalytics(boostId: string, data: Partial<BoostAnalytics>) {
        await db.update(boostAnalyticsTable)
            .set({ ...data, updated_at: new Date() })
            .where(eq(boostAnalyticsTable.boost_id, boostId));
    }

    // ============================================
    // EXPIRE BOOSTS (for cron job)
    // ============================================

    async expireBoosts(): Promise<number> {
        const now = new Date();

        // Find expired active boosts
        const expiredBoosts = await db.select({ id: boostsTable.id, venue_match_id: boostsTable.venue_match_id })
            .from(boostsTable)
            .where(and(
                eq(boostsTable.status, 'used'),
                lt(boostsTable.expires_at, now)
            ));

        if (expiredBoosts.length === 0) {
            return 0;
        }

        const boostIds = expiredBoosts.map(b => b.id);
        const venueMatchIds = expiredBoosts
            .filter(b => b.venue_match_id)
            .map(b => b.venue_match_id as string);

        // Mark boosts as expired
        await db.update(boostsTable)
            .set({
                status: 'expired',
                updated_at: new Date(),
            })
            .where(inArray(boostsTable.id, boostIds));

        // Update venue matches
        if (venueMatchIds.length > 0) {
            await db.update(venueMatchesTable)
                .set({
                    is_boosted: false,
                    boost_id: null,
                    boost_expires_at: null,
                    updated_at: new Date(),
                })
                .where(inArray(venueMatchesTable.id, venueMatchIds));
        }

        // Close analytics
        await db.update(boostAnalyticsTable)
            .set({
                boost_ended_at: new Date(),
                updated_at: new Date(),
            })
            .where(inArray(boostAnalyticsTable.boost_id, boostIds));

        return expiredBoosts.length;
    }

    // ============================================
    // REFUND BOOSTS
    // ============================================

    async refundBoostsByPurchase(purchaseId: string): Promise<number> {
        const result = await db.update(boostsTable)
            .set({
                status: 'expired',
                updated_at: new Date(),
            })
            .where(and(
                eq(boostsTable.purchase_id, purchaseId),
                eq(boostsTable.status, 'available')
            ))
            .returning({ id: boostsTable.id });

        return result.length;
    }
}

export default new BoostRepository();
