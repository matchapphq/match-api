import { db } from "../config/config.db";
import { eq, and, sql, desc, asc, count, sum } from "drizzle-orm";
import {
    betaBugReportsTable,
    venueSuggestionsTable,
    userScanHistoryTable,
} from "../config/db/beta-challenge.table";
import {
    fidelityPointTransactionsTable,
    fidelityUserStatsTable,
} from "../config/db/fidelity.table";
import { usersTable } from "../config/db/user.table";
import { referralsTable } from "../config/db/referral.table";
import type { LeaderboardEntry } from "../modules/challenge/challenge.types";

export class ChallengeRepository {
    /**
     * Get the leaderboard Top 25
     */
    async getLeaderboard(currentUserId?: string): Promise<LeaderboardEntry[]> {
        // We use a CTE or complex join to get everything in one go
        // 1. Total Buts from stats table
        // 2. Count of unique scans from scan history
        // 3. Count of active referrals
        
        const result = await db.select({
            id: usersTable.id,
            username: usersTable.username,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
            avatar_url: usersTable.avatar_url,
            total_buts: fidelityUserStatsTable.total_points,
            visites: fidelityUserStatsTable.total_check_ins,
            parrainages: fidelityUserStatsTable.total_invites_completed,
        })
        .from(usersTable)
        .innerJoin(fidelityUserStatsTable, eq(usersTable.id, fidelityUserStatsTable.user_id))
        .orderBy(
            desc(fidelityUserStatsTable.total_points),
            desc(fidelityUserStatsTable.total_check_ins),
            desc(fidelityUserStatsTable.total_invites_completed),
            asc(usersTable.created_at)
        )
        .limit(25);

        return result.map((row, index) => ({
            rank: index + 1,
            userId: row.id,
            name: row.username || [row.first_name, row.last_name].filter(Boolean).join(" ") || "Utilisateur Match",
            avatarUrl: row.avatar_url || undefined,
            buts: row.total_buts,
            visites: row.visites || 0,
            parrainages: row.parrainages || 0,
            isUser: row.id === currentUserId,
        }));
    }

    /**
     * Get user's current rank
     */
    async getUserRank(userId: string): Promise<number> {
        const userStats = await db.select({ total_points: fidelityUserStatsTable.total_points })
            .from(fidelityUserStatsTable)
            .where(eq(fidelityUserStatsTable.user_id, userId))
            .limit(1);

        if (userStats.length === 0) return 0;

        const points = userStats[0]!.total_points;

        const result = await db.select({
            count: count(),
        })
        .from(fidelityUserStatsTable)
        .where(sql`${fidelityUserStatsTable.total_points} > ${points}`);

        return Number(result[0]!.count) + 1;
    }

    /**
     * Get last scan for a user at a venue today
     */
    async getLastScanToday(userId: string, venueId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return db.query.userScanHistoryTable.findFirst({
            where: and(
                eq(userScanHistoryTable.user_id, userId),
                eq(userScanHistoryTable.venue_id, venueId),
                sql`${userScanHistoryTable.scanned_at} >= ${today.toISOString()}`
            )
        });
    }

    /**
     * Record a scan
     */
    async recordScan(data: any) {
        return db.insert(userScanHistoryTable).values(data).returning();
    }

    /**
     * Increment specific stat in fidelity_user_stats
     */
    async incrementStat(userId: string, field: 'total_check_ins' | 'total_invites_completed' | 'total_reviews') {
        return db.update(fidelityUserStatsTable)
            .set({
                [field]: sql`${fidelityUserStatsTable[field]} + 1`,
                updated_at: new Date()
            })
            .where(eq(fidelityUserStatsTable.user_id, userId));
    }

    /**
     * Get confirmed bug count for a user
     */
    async getConfirmedBugCount(userId: string): Promise<number> {
        const result = await db.select({ count: count() })
            .from(betaBugReportsTable)
            .where(and(
                eq(betaBugReportsTable.user_id, userId),
                eq(betaBugReportsTable.status, 'confirmed')
            ));
        return Number(result[0]!.count);
    }

    /**
     * Create a bug report
     */
    async createBugReport(userId: string, data: any) {
        return db.insert(betaBugReportsTable).values({
            user_id: userId,
            title: data.title,
            description: data.description,
            steps_to_reproduce: data.steps,
            platform: data.platform,
            app_version: data.version,
            screenshots: data.screenshots
        }).returning();
    }

    /**
     * Create a venue suggestion
     */
    async createVenueSuggestion(userId: string, data: any) {
        return db.insert(venueSuggestionsTable).values({
            user_id: userId,
            name: data.name,
            address: data.address,
            city: data.city,
            google_maps_url: data.mapsUrl,
            instagram_handle: data.instagram,
            comment: data.comment
        }).returning();
    }

    /**
     * Get bug report by ID
     */
    async getBugReportById(id: string) {
        return db.query.betaBugReportsTable.findFirst({
            where: eq(betaBugReportsTable.id, id)
        });
    }

    /**
     * Update bug status
     */
    async updateBugStatus(id: string, status: string, pointsAwarded: boolean) {
        return db.update(betaBugReportsTable)
            .set({ status, points_awarded: pointsAwarded, updated_at: new Date() })
            .where(eq(betaBugReportsTable.id, id));
    }
}

export const challengeRepository = new ChallengeRepository();
