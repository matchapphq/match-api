import { db } from "../config/config.db";
import { 
    referralCodesTable, 
    referralsTable, 
    referralStatsTable, 
    boostsTable,
    type ReferralCode,
    type NewReferralCode,
    type NewReferral,
    type NewReferralStats,
    type NewBoost
} from "../config/db/referral.table";
import { usersTable } from "../config/db/user.table";
import { eq, and, sql, desc } from "drizzle-orm";

const REFERRAL_BASE_URL = process.env.REFERRAL_BASE_URL || 'https://match.app/signup?ref=';
const BOOST_VALUE = Number(process.env.BOOST_VALUE) || 30;

export class ReferralRepository {

    /**
     * Generate a unique referral code in format MATCH-RESTO-XXXXXX
     */
    private generateReferralCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'MATCH-RESTO-';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Get referral code for a user
     */
    async getReferralCode(userId: string): Promise<ReferralCode | null> {
        const result = await db.select()
            .from(referralCodesTable)
            .where(eq(referralCodesTable.user_id, userId))
            .limit(1);
        return result[0] ?? null;
    }

    /**
     * Create a referral code for a user (if not exists)
     */
    async createReferralCode(userId: string): Promise<ReferralCode | null> {
        const existing = await this.getReferralCode(userId);
        if (existing) return existing;

        let referralCode: string;
        let attempts = 0;
        const maxAttempts = 10;

        do {
            referralCode = this.generateReferralCode();
            const existingCode = await db.select({ id: referralCodesTable.id })
                .from(referralCodesTable)
                .where(eq(referralCodesTable.referral_code, referralCode))
                .limit(1);
            
            if (existingCode.length === 0) break;
            attempts++;
        } while (attempts < maxAttempts);

        if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique referral code');
        }

        const result = await db.insert(referralCodesTable).values({
            user_id: userId,
            referral_code: referralCode,
            referral_link: `${REFERRAL_BASE_URL}${referralCode}`,
        }).returning();

        await this.initializeStats(userId);

        return result[0] ?? null;
    }

    /**
     * Initialize referral stats for a user
     */
    async initializeStats(userId: string) {
        const existing = await db.select({ id: referralStatsTable.id })
            .from(referralStatsTable)
            .where(eq(referralStatsTable.user_id, userId))
            .limit(1);

        if (existing.length > 0) return;

        await db.insert(referralStatsTable).values({
            user_id: userId,
        });
    }

    /**
     * Get referral stats for a user
     */
    async getReferralStats(userId: string) {
        const result = await db.select()
            .from(referralStatsTable)
            .where(eq(referralStatsTable.user_id, userId))
            .limit(1);

        if (!result[0]) {
            return {
                total_invited: 0,
                total_signed_up: 0,
                total_converted: 0,
                total_rewards_earned: 0,
                rewards_value: '0',
                conversion_rate: 0,
            };
        }

        const stats = result[0];
        const conversionRate = stats.total_invited > 0 
            ? (stats.total_converted / stats.total_invited) * 100 
            : 0;

        return {
            ...stats,
            conversion_rate: Math.round(conversionRate * 10) / 10,
        };
    }

    /**
     * Validate a referral code
     */
    async validateReferralCode(code: string) {
        const result = await db.select({
            referral_code: referralCodesTable.referral_code,
            user_id: referralCodesTable.user_id,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
        })
            .from(referralCodesTable)
            .innerJoin(usersTable, eq(referralCodesTable.user_id, usersTable.id))
            .where(eq(referralCodesTable.referral_code, code))
            .limit(1);

        if (!result[0]) {
            return { valid: false, referrer_name: null };
        }

        const firstName = result[0].first_name || '';
        const lastName = result[0].last_name || '';
        const referrerName = `${firstName.charAt(0).toUpperCase()}${firstName.slice(1).toLowerCase()} ${lastName.charAt(0).toUpperCase()}.`;

        return {
            valid: true,
            referrer_name: referrerName,
            referrer_id: result[0].user_id,
        };
    }

    /**
     * Find referrer by referral code
     */
    async findReferrerByCode(code: string): Promise<string | null> {
        const result = await db.select({ user_id: referralCodesTable.user_id })
            .from(referralCodesTable)
            .where(eq(referralCodesTable.referral_code, code))
            .limit(1);
        return result[0]?.user_id || null;
    }

    /**
     * Register a referral when a new user signs up with a code
     */
    async registerReferral(referralCode: string, referredUserId: string): Promise<{ success: boolean; error?: string; referral_id?: string }> {
        const referrerId = await this.findReferrerByCode(referralCode);

        if (!referrerId) {
            return { success: false, error: 'Invalid referral code' };
        }

        if (referrerId === referredUserId) {
            return { success: false, error: 'Cannot refer yourself' };
        }

        const existingReferral = await db.select({ id: referralsTable.id })
            .from(referralsTable)
            .where(eq(referralsTable.referred_user_id, referredUserId))
            .limit(1);

        if (existingReferral.length > 0) {
            return { success: false, error: 'User already referred' };
        }

        const newReferralResult = await db.insert(referralsTable).values({
            referrer_id: referrerId,
            referred_user_id: referredUserId,
            referral_code: referralCode,
            status: 'signed_up',
            signed_up_at: new Date(),
        }).returning();

        const newReferral = newReferralResult[0];
        if (!newReferral) {
            return { success: false, error: 'Failed to create referral' };
        }

        await db.update(referralStatsTable)
            .set({
                total_invited: sql`${referralStatsTable.total_invited} + 1`,
                total_signed_up: sql`${referralStatsTable.total_signed_up} + 1`,
                updated_at: new Date(),
            })
            .where(eq(referralStatsTable.user_id, referrerId));

        return { success: true, referral_id: newReferral.id };
    }

    /**
     * Convert a referral (give boost to referrer) - called after first payment
     */
    async convertReferral(referredUserId: string): Promise<{ success: boolean; error?: string; referral_id?: string; boost_id?: string; referrer_id?: string }> {
        const referral = await db.select()
            .from(referralsTable)
            .where(and(
                eq(referralsTable.referred_user_id, referredUserId),
                eq(referralsTable.status, 'signed_up')
            ))
            .limit(1);

        if (!referral[0]) {
            return { success: false, error: 'No active referral found' };
        }

        const referralRecord = referral[0];

        await db.update(referralsTable)
            .set({
                status: 'converted',
                converted_at: new Date(),
                reward_granted: true,
                reward_type: 'boost',
                reward_value: 1,
                updated_at: new Date(),
            })
            .where(eq(referralsTable.id, referralRecord.id));

        const boostResult = await db.insert(boostsTable).values({
            user_id: referralRecord.referrer_id,
            type: 'referral',
            status: 'available',
            source: 'referral_reward',
            metadata: {
                referral_id: referralRecord.id,
                referred_user_id: referredUserId,
                converted_at: new Date().toISOString(),
            },
        }).returning();

        const boost = boostResult[0];
        if (!boost) {
            return { success: false, error: 'Failed to create boost' };
        }

        await db.update(referralStatsTable)
            .set({
                total_converted: sql`${referralStatsTable.total_converted} + 1`,
                total_rewards_earned: sql`${referralStatsTable.total_rewards_earned} + 1`,
                rewards_value: sql`${referralStatsTable.rewards_value} + ${BOOST_VALUE}`,
                updated_at: new Date(),
            })
            .where(eq(referralStatsTable.user_id, referralRecord.referrer_id));

        return {
            success: true,
            referral_id: referralRecord.id,
            boost_id: boost.id,
            referrer_id: referralRecord.referrer_id,
        };
    }

    /**
     * Get referral history for a user (with pagination)
     */
    async getReferralHistory(
        userId: string,
        options: { page?: number; limit?: number; status?: string } = {}
    ) {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const offset = (page - 1) * limit;
        const statusFilter = options.status || 'all';

        let query = db.select({
            id: referralsTable.id,
            status: referralsTable.status,
            reward_granted: referralsTable.reward_granted,
            invited_at: referralsTable.invited_at,
            signed_up_at: referralsTable.signed_up_at,
            converted_at: referralsTable.converted_at,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
        })
            .from(referralsTable)
            .leftJoin(usersTable, eq(referralsTable.referred_user_id, usersTable.id))
            .where(eq(referralsTable.referrer_id, userId))
            .orderBy(desc(referralsTable.created_at))
            .limit(limit)
            .offset(offset);

        const referrals = await query;

        const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(referralsTable)
            .where(eq(referralsTable.referrer_id, userId));

        const total = Number(countResult[0]?.count) || 0;

        const referredUsers = referrals.map(r => {
            const firstName = r.first_name || 'Utilisateur';
            const lastName = r.last_name || '';
            const name = lastName 
                ? `${firstName.charAt(0).toUpperCase()}${firstName.slice(1).toLowerCase()} ${lastName.charAt(0).toUpperCase()}.`
                : firstName;

            return {
                id: r.id,
                name,
                status: r.status,
                reward_earned: r.reward_granted ? '1 boost' : null,
                created_at: r.invited_at?.toISOString(),
                signed_up_at: r.signed_up_at?.toISOString(),
                converted_at: r.converted_at?.toISOString(),
            };
        });

        return {
            referred_users: referredUsers,
            total,
            page,
            limit,
        };
    }

    /**
     * Get available boosts for a user
     */
    async getAvailableBoosts(userId: string) {
        return await db.select()
            .from(boostsTable)
            .where(and(
                eq(boostsTable.user_id, userId),
                eq(boostsTable.status, 'available')
            ));
    }

    /**
     * Use a boost for a venue match
     */
    async useBoost(boostId: string, userId: string, venueMatchId: string): Promise<{ success: boolean; error?: string }> {
        const boost = await db.select()
            .from(boostsTable)
            .where(and(
                eq(boostsTable.id, boostId),
                eq(boostsTable.user_id, userId),
                eq(boostsTable.status, 'available')
            ))
            .limit(1);

        if (!boost[0]) {
            return { success: false, error: 'Boost not found or already used' };
        }

        await db.update(boostsTable)
            .set({
                status: 'used',
                venue_match_id: venueMatchId,
                used_at: new Date(),
                updated_at: new Date(),
            })
            .where(eq(boostsTable.id, boostId));

        return { success: true };
    }

    /**
     * Check if a user has been referred (for preventing double referral)
     */
    async hasBeenReferred(userId: string): Promise<boolean> {
        const result = await db.select({ id: referralsTable.id })
            .from(referralsTable)
            .where(eq(referralsTable.referred_user_id, userId))
            .limit(1);
        return result.length > 0;
    }
}

export default new ReferralRepository();
