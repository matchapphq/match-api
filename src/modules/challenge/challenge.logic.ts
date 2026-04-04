import { challengeRepository } from "../../repository/challenge.repository";
import { fidelityRepository } from "../../repository/fidelity.repository";
import referralRepository from "../../repository/referral.repository";
import { FidelityLogic } from "../fidelity/fidelity.logic";
import type { 
    ChallengeStatus, 
    LeaderboardEntry, 
    ScanResult,
    ChallengeActionType,
} from "./challenge.types";

export class ChallengeLogic {
    private readonly fidelityLogic: FidelityLogic;

    constructor() {
        this.fidelityLogic = new FidelityLogic();
    }

    /**
     * Get user's current status in the challenge
     */
    async getStatus(userId: string): Promise<ChallengeStatus> {
        const stats = await fidelityRepository.getUserStats(userId);
        const rank = await challengeRepository.getUserRank(userId);
        
        const totalButs = stats?.total_points || 0;
        
        // Milestone logic (simplified for now)
        let target = 500;
        let label = "Top 10";
        if (totalButs >= 500) {
            target = 1000;
            label = "Top 3";
        }

        return {
            rank,
            totalButs,
            streakDays: stats?.current_streak_days || 0,
            nextMilestone: {
                target,
                progress: Math.min(100, Math.round((totalButs / target) * 100)),
                label
            }
        };
    }

    /**
     * Get the Top 25 leaderboard
     */
    async getLeaderboard(userId?: string): Promise<LeaderboardEntry[]> {
        return challengeRepository.getLeaderboard(userId);
    }

    /**
     * Handle QR scan at a venue
     */
    async handleScan(userId: string, venueId: string, location?: { lat: string, lng: string }): Promise<ScanResult> {
        // 1. Check if already scanned today
        const lastScan = await challengeRepository.getLastScanToday(userId, venueId);
        if (lastScan) {
            return {
                success: false,
                pointsAwarded: 0,
                message: "Vous avez déjà scanné ce lieu aujourd'hui."
            };
        }

        // 2. Award Points
        const pointsResult = await this.fidelityLogic.awardPoints({
            userId,
            actionKey: "BETA_VENUE_SCAN",
            referenceId: venueId,
            referenceType: "venue",
            metadata: { location }
        });

        if (pointsResult.success) {
            await challengeRepository.recordScan({
                user_id: userId,
                venue_id: venueId,
                latitude: location?.lat,
                longitude: location?.lng,
                points_awarded: pointsResult.pointsAwarded,
                is_verified: true
            });

            await challengeRepository.incrementStat(userId, 'total_check_ins');

            // 3. Check for 'Filleul Visitor' (+10 for referrer)
            const referral = await referralRepository.getReferralByReferredId(userId);
            if (referral && referral.status === 'signed_up') {
                // First scan for this referred user
                await this.fidelityLogic.awardPoints({
                    userId: referral.referrer_id,
                    actionKey: "BETA_REFERRAL_VISITOR",
                    referenceId: userId,
                    referenceType: "referral_visitor",
                    metadata: { venueId }
                }).catch(err => console.error("[BetaChallenge] Filleul visitor points failed:", err));
                
                // Update referral status to show they visited
                await referralRepository.updateReferralStatus(referral.id, 'converted' as any);
            }

            return {
                success: true,
                pointsAwarded: pointsResult.pointsAwarded,
                message: `Bravo ! +${pointsResult.pointsAwarded} buts.`
            };
        }

        return {
            success: false,
            pointsAwarded: 0,
            message: pointsResult.reason || "Échec du scan."
        };
    }

    /**
     * Submit a bug report
     */
    async submitBugReport(userId: string, data: any) {
        return challengeRepository.createBugReport(userId, data);
    }

    /**
     * Submit a venue suggestion
     */
    async submitVenueSuggestion(userId: string, data: any) {
        return challengeRepository.createVenueSuggestion(userId, data);
    }

    /**
     * Process daily connection / streak
     */
    async processDailyConnection(userId: string) {
        // This should be called once per day per user
        // Award +1 but
        return this.fidelityLogic.awardPoints({
            userId,
            actionKey: "BETA_DAILY_CONNECTION",
            referenceId: new Date().toISOString().split('T')[0]!,
            referenceType: "daily_connection"
        });
    }
}

export const challengeLogic = new ChallengeLogic();
