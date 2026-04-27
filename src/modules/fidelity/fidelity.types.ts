export type FidelityActionKey =
    | "BOOK_RESERVATION"
    | "CHECK_IN"
    | "CREATE_REVIEW"
    | "INVITE_COMPLETED"
    | "FIRST_VENUE_VISIT"
    | "PROFILE_COMPLETED"
    | "SHARE_APP"
    | "BADGE_UNLOCK_BONUS"
    | "CHALLENGE_COMPLETED"
    | "BETA_REFERRAL_AWARD"
    | "BETA_REVIEW_COMPLETE"
    | "BETA_REVIEW_SHORT";

export type PointsAwardContext = {
    userId: string;
    actionKey: FidelityActionKey | string;
    referenceId: string;
    referenceType: string;
    metadata?: Record<string, unknown>;
};

export type PointsResult = {
    success: boolean;
    pointsAwarded: number;
    newTotalPoints: number;
    reason?: string;
    transactionId?: string;
};

export type LevelResult = {
    levelId: string;
    levelName: string;
    levelRank: number;
    totalPoints: number;
    leveledUp: boolean;
    nextLevel?: {
        name: string;
        pointsRequired: number;
        pointsRemaining: number;
        progressPercentage: number;
    };
};

export type BadgeUnlockResult = {
    badgeId: string;
    badgeName: string;
    category: string;
    pointsAwarded: number;
    unlockedAt: Date | string;
};

export type ChallengeUpdateResult = {
    challengeId: string;
    challengeName: string;
    status: "IN_PROGRESS" | "COMPLETED";
    progressCount: number;
    targetCount: number;
    completed: boolean;
    pointsAwarded?: number;
    badgeAwarded?: string;
};

export type FidelitySummary = {
    level: {
        id: string;
        name: string;
        rank: number;
        color?: string;
        iconKey?: string;
    };
    points: {
        total: number;
        thisMonth: number;
        thisWeek: number;
    };
    progress: {
        pointsToNextLevel: number;
        progressPercentage: number;
        nextLevelName?: string;
    };
    stats: {
        totalReservations: number;
        totalCheckIns: number;
        totalReviews: number;
        totalVenuesVisited: number;
        currentStreak: number;
    };
    badges: {
        total: number;
        recent: Array<{
            id: string;
            name: string;
            iconKey?: string;
            unlockedAt: Date | string;
        }>;
    };
    activeChallenges: number;
    suggestedActions: Array<{
        actionKey: string;
        displayName: string;
        points: number;
        description?: string;
    }>;
};

export type UserBadgesView = {
    unlocked: Array<{
        id: string;
        badgeId: string;
        name: string;
        description?: string;
        category: string;
        iconKey?: string;
        color?: string;
        unlockedAt: Date | string;
        pointsAwarded: number;
    }>;
    locked: Array<{
        id: string;
        name: string;
        description?: string;
        category: string;
        iconKey?: string;
        isSecret: boolean;
        progress?: {
            current: number;
            target: number;
            percentage: number;
        };
    }>;
};

export type UserChallengesView = {
    active: Array<{
        id: string;
        challengeId: string;
        name: string;
        description?: string;
        status: string;
        progressCount: number;
        targetCount: number;
        progressPercentage: number;
        rewardPoints: number;
        rewardBadge?: string;
        expiresAt?: Date | string;
        iconKey?: string;
        color?: string;
    }>;
    completed: Array<{
        id: string;
        challengeId: string;
        name: string;
        completedAt: Date | string;
        pointsAwarded: number;
        badgeAwarded: boolean;
    }>;
};

export type FidelityEvent = {
    type: string;
    userId: string;
    payload: Record<string, any>;
};

export type FidelityEventResult = {
    pointsAwarded: number;
    newLevel?: LevelResult;
    badgesUnlocked: BadgeUnlockResult[];
    challengesUpdated: ChallengeUpdateResult[];
};
