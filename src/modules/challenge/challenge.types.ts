export type ChallengeActionType =
    | 'BETA_SIGNUP'
    | 'BETA_REFERRAL_SIGNUP'
    | 'BETA_PROFILE_COMPLETED'
    | 'BETA_REFERRAL_AWARD'
    | 'BETA_REFERRAL_ACTIVE_7D'
    | 'BETA_REFERRAL_VISITOR'
    | 'BETA_STORY_SHARE'
    | 'BETA_VENUE_SCAN'
    | 'BETA_REVIEW_SHORT'
    | 'BETA_REVIEW_COMPLETE'
    | 'BETA_DAILY_CONNECTION'
    | 'BETA_STREAK_7D'
    | 'BETA_STREAK_14D'
    | 'BETA_VENUE_SUGGESTION'
    | 'BETA_BUG_REPORT';

export interface ChallengeStatus {
    rank: number;
    totalButs: number;
    streakDays: number;
    nextMilestone: {
        target: number;
        progress: number;
        label: string;
    };
}

export interface LeaderboardEntry {
    rank: number;
    userId: string;
    name: string;
    avatarUrl?: string;
    buts: number;
    visites: number;
    parrainages: number;
    isUser: boolean;
}

export interface ScanResult {
    success: boolean;
    pointsAwarded: number;
    message?: string;
}
