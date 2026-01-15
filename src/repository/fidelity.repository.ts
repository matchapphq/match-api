import { db } from "../config/config.db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
    fidelityLevelsTable,
    fidelityPointRulesTable,
    fidelityPointTransactionsTable,
    fidelityUserStatsTable,
    fidelityBadgesTable,
    fidelityUserBadgesTable,
    fidelityChallengesTable,
    fidelityUserChallengesTable,
    fidelityEventsLogTable,
} from "../config/db/fidelity.table";
import type {
    FidelityLevel,
    FidelityPointRule,
    FidelityPointTransaction,
    FidelityUserStats,
    FidelityBadge,
    FidelityUserBadge,
    FidelityChallenge,
    FidelityUserChallenge,
    NewFidelityPointTransaction,
    NewFidelityUserStats,
    NewFidelityUserBadge,
    NewFidelityUserChallenge,
    NewFidelityEventLog,
} from "../config/db/fidelity.table";

export class FidelityRepository {
    // ============================================
    // LEVELS
    // ============================================

    async getAllLevels(): Promise<FidelityLevel[]> {
        return db.query.fidelityLevelsTable.findMany({
            where: eq(fidelityLevelsTable.is_active, true),
            orderBy: [fidelityLevelsTable.rank],
        });
    }

    async getLevelById(id: string): Promise<FidelityLevel | undefined> {
        return db.query.fidelityLevelsTable.findFirst({
            where: eq(fidelityLevelsTable.id, id),
        });
    }

    async getLevelForPoints(points: number): Promise<FidelityLevel | undefined> {
        const levels = await db.query.fidelityLevelsTable.findMany({
            where: and(
                eq(fidelityLevelsTable.is_active, true),
                lte(fidelityLevelsTable.min_points, points)
            ),
            orderBy: [desc(fidelityLevelsTable.min_points)],
            limit: 1,
        });
        return levels[0];
    }

    async getNextLevel(currentPoints: number): Promise<FidelityLevel | undefined> {
        const levels = await db.query.fidelityLevelsTable.findMany({
            where: and(
                eq(fidelityLevelsTable.is_active, true),
                sql`${fidelityLevelsTable.min_points} > ${currentPoints}`
            ),
            orderBy: [fidelityLevelsTable.min_points],
            limit: 1,
        });
        return levels[0];
    }

    // ============================================
    // POINT RULES
    // ============================================

    async getPointRule(actionKey: string): Promise<FidelityPointRule | undefined> {
        return db.query.fidelityPointRulesTable.findFirst({
            where: and(
                eq(fidelityPointRulesTable.action_key, actionKey),
                eq(fidelityPointRulesTable.is_active, true)
            ),
        });
    }

    async getAllPointRules(): Promise<FidelityPointRule[]> {
        return db.query.fidelityPointRulesTable.findMany({
            where: eq(fidelityPointRulesTable.is_active, true),
        });
    }

    // ============================================
    // POINT TRANSACTIONS
    // ============================================

    async createPointTransaction(data: NewFidelityPointTransaction): Promise<FidelityPointTransaction> {
        const result = await db.insert(fidelityPointTransactionsTable)
            .values(data)
            .returning();
        return result[0]!;
    }

    async getPointTransaction(userId: string, actionKey: string, referenceId: string): Promise<FidelityPointTransaction | undefined> {
        return db.query.fidelityPointTransactionsTable.findFirst({
            where: and(
                eq(fidelityPointTransactionsTable.user_id, userId),
                eq(fidelityPointTransactionsTable.action_key, actionKey),
                eq(fidelityPointTransactionsTable.reference_id, referenceId)
            ),
        });
    }

    async getUserPointTransactions(userId: string, limit = 50, offset = 0): Promise<FidelityPointTransaction[]> {
        return db.query.fidelityPointTransactionsTable.findMany({
            where: eq(fidelityPointTransactionsTable.user_id, userId),
            orderBy: [desc(fidelityPointTransactionsTable.created_at)],
            limit,
            offset,
        });
    }

    async getUserTotalPoints(userId: string): Promise<number> {
        const result = await db.select({
            total: sql<number>`COALESCE(SUM(${fidelityPointTransactionsTable.points}), 0)`,
        })
            .from(fidelityPointTransactionsTable)
            .where(eq(fidelityPointTransactionsTable.user_id, userId));
        return result[0]?.total ?? 0;
    }

    async getUserPointsInPeriod(userId: string, startDate: Date, endDate: Date): Promise<number> {
        const result = await db.select({
            total: sql<number>`COALESCE(SUM(${fidelityPointTransactionsTable.points}), 0)`,
        })
            .from(fidelityPointTransactionsTable)
            .where(and(
                eq(fidelityPointTransactionsTable.user_id, userId),
                gte(fidelityPointTransactionsTable.created_at, startDate),
                lte(fidelityPointTransactionsTable.created_at, endDate)
            ));
        return result[0]?.total ?? 0;
    }

    async getUserActionCountToday(userId: string, actionKey: string): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const result = await db.select({
            count: sql<number>`COUNT(*)`,
        })
            .from(fidelityPointTransactionsTable)
            .where(and(
                eq(fidelityPointTransactionsTable.user_id, userId),
                eq(fidelityPointTransactionsTable.action_key, actionKey),
                gte(fidelityPointTransactionsTable.created_at, today),
                lte(fidelityPointTransactionsTable.created_at, tomorrow)
            ));
        return result[0]?.count ?? 0;
    }

    // ============================================
    // USER STATS
    // ============================================

    async getUserStats(userId: string): Promise<FidelityUserStats | undefined> {
        return db.query.fidelityUserStatsTable.findFirst({
            where: eq(fidelityUserStatsTable.user_id, userId),
        });
    }

    async upsertUserStats(userId: string, updates: Partial<NewFidelityUserStats>): Promise<FidelityUserStats> {
        const existing = await this.getUserStats(userId);
        
        if (existing) {
            const result = await db.update(fidelityUserStatsTable)
                .set({ ...updates, updated_at: new Date() })
                .where(eq(fidelityUserStatsTable.user_id, userId))
                .returning();
            return result[0]!;
        } else {
            const result = await db.insert(fidelityUserStatsTable)
                .values({ user_id: userId, ...updates })
                .returning();
            return result[0]!;
        }
    }

    async incrementUserStat(userId: string, field: keyof FidelityUserStats, amount = 1): Promise<void> {
        await this.getUserStats(userId) || await this.upsertUserStats(userId, {});
        
        await db.update(fidelityUserStatsTable)
            .set({
                [field]: sql`COALESCE(${fidelityUserStatsTable[field as keyof typeof fidelityUserStatsTable]}, 0) + ${amount}`,
                updated_at: new Date(),
            })
            .where(eq(fidelityUserStatsTable.user_id, userId));
    }

    // ============================================
    // BADGES
    // ============================================

    async getAllBadges(): Promise<FidelityBadge[]> {
        return db.query.fidelityBadgesTable.findMany({
            where: eq(fidelityBadgesTable.is_active, true),
            orderBy: [fidelityBadgesTable.rank],
        });
    }

    async getBadgeById(id: string): Promise<FidelityBadge | undefined> {
        return db.query.fidelityBadgesTable.findFirst({
            where: eq(fidelityBadgesTable.id, id),
        });
    }

    async getBadgesByCategory(category: string): Promise<FidelityBadge[]> {
        return db.query.fidelityBadgesTable.findMany({
            where: and(
                eq(fidelityBadgesTable.category, category as any),
                eq(fidelityBadgesTable.is_active, true)
            ),
            orderBy: [fidelityBadgesTable.rank],
        });
    }

    // ============================================
    // USER BADGES
    // ============================================

    async getUserBadges(userId: string): Promise<FidelityUserBadge[]> {
        return db.query.fidelityUserBadgesTable.findMany({
            where: eq(fidelityUserBadgesTable.user_id, userId),
            orderBy: [desc(fidelityUserBadgesTable.unlocked_at)],
        });
    }

    async hasUserBadge(userId: string, badgeId: string): Promise<boolean> {
        const badge = await db.query.fidelityUserBadgesTable.findFirst({
            where: and(
                eq(fidelityUserBadgesTable.user_id, userId),
                eq(fidelityUserBadgesTable.badge_id, badgeId)
            ),
        });
        return !!badge;
    }

    async unlockBadge(data: NewFidelityUserBadge): Promise<FidelityUserBadge> {
        const result = await db.insert(fidelityUserBadgesTable)
            .values(data)
            .returning();
        return result[0]!;
    }

    // ============================================
    // CHALLENGES
    // ============================================

    async getActiveChallenges(): Promise<FidelityChallenge[]> {
        const now = new Date();
        return db.query.fidelityChallengesTable.findMany({
            where: and(
                eq(fidelityChallengesTable.is_active, true),
                sql`(${fidelityChallengesTable.start_at} IS NULL OR ${fidelityChallengesTable.start_at} <= ${now})`,
                sql`(${fidelityChallengesTable.end_at} IS NULL OR ${fidelityChallengesTable.end_at} >= ${now})`
            ),
            orderBy: [fidelityChallengesTable.rank],
        });
    }

    async getChallengeById(id: string): Promise<FidelityChallenge | undefined> {
        return db.query.fidelityChallengesTable.findFirst({
            where: eq(fidelityChallengesTable.id, id),
        });
    }

    async getChallengesByActionKey(actionKey: string): Promise<FidelityChallenge[]> {
        const now = new Date();
        return db.query.fidelityChallengesTable.findMany({
            where: and(
                eq(fidelityChallengesTable.action_key, actionKey),
                eq(fidelityChallengesTable.is_active, true),
                sql`(${fidelityChallengesTable.start_at} IS NULL OR ${fidelityChallengesTable.start_at} <= ${now})`,
                sql`(${fidelityChallengesTable.end_at} IS NULL OR ${fidelityChallengesTable.end_at} >= ${now})`
            ),
        });
    }

    // ============================================
    // USER CHALLENGES
    // ============================================

    async getUserChallenges(userId: string): Promise<FidelityUserChallenge[]> {
        return db.query.fidelityUserChallengesTable.findMany({
            where: eq(fidelityUserChallengesTable.user_id, userId),
            orderBy: [desc(fidelityUserChallengesTable.created_at)],
        });
    }

    async getUserActiveChallenge(userId: string, challengeId: string): Promise<FidelityUserChallenge | undefined> {
        return db.query.fidelityUserChallengesTable.findFirst({
            where: and(
                eq(fidelityUserChallengesTable.user_id, userId),
                eq(fidelityUserChallengesTable.challenge_id, challengeId),
                sql`${fidelityUserChallengesTable.status} IN ('NOT_STARTED', 'IN_PROGRESS')`
            ),
        });
    }

    async createUserChallenge(data: NewFidelityUserChallenge): Promise<FidelityUserChallenge> {
        const result = await db.insert(fidelityUserChallengesTable)
            .values(data)
            .returning();
        return result[0]!;
    }

    async updateUserChallenge(id: string, updates: Partial<FidelityUserChallenge>): Promise<FidelityUserChallenge> {
        const result = await db.update(fidelityUserChallengesTable)
            .set({ ...updates, updated_at: new Date() })
            .where(eq(fidelityUserChallengesTable.id, id))
            .returning();
        return result[0]!;
    }

    async expireUserChallenges(): Promise<number> {
        const now = new Date();
        const result = await db.update(fidelityUserChallengesTable)
            .set({ status: 'EXPIRED', updated_at: now })
            .where(and(
                sql`${fidelityUserChallengesTable.status} IN ('NOT_STARTED', 'IN_PROGRESS')`,
                lte(fidelityUserChallengesTable.expires_at, now)
            ));
        return result.rowCount ?? 0;
    }

    // ============================================
    // EVENT LOG
    // ============================================

    async logEvent(data: NewFidelityEventLog): Promise<void> {
        await db.insert(fidelityEventsLogTable).values(data);
    }

    async getUserEventLog(userId: string, limit = 50): Promise<any[]> {
        return db.query.fidelityEventsLogTable.findMany({
            where: eq(fidelityEventsLogTable.user_id, userId),
            orderBy: [desc(fidelityEventsLogTable.created_at)],
            limit,
        });
    }
}

export const fidelityRepository = new FidelityRepository();
