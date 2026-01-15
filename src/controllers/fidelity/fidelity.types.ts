// ============================================
// FIDELITY DOMAIN TYPES
// ============================================

export type FidelityActionKey = 
    | 'BOOK_RESERVATION'
    | 'CHECK_IN'
    | 'CREATE_REVIEW'
    | 'FIRST_VENUE_VISIT'
    | 'INVITE_COMPLETED'
    | 'PROFILE_COMPLETED'
    | 'SHARE_APP';

export interface PointsAwardContext {
    userId: string;
    actionKey: FidelityActionKey;
    referenceId: string;
    referenceType: string;
    metadata?: {
        venueId?: string;
        matchId?: string;
        reviewLength?: number;
        hasPhoto?: boolean;
        [key: string]: any;
    };
}

export interface PointsResult {
    success: boolean;
    pointsAwarded: number;
    newTotalPoints: number;
    reason?: string;
    transactionId?: string;
}

export interface LevelResult {
    levelId: string;
    levelName: string;
    levelRank: number;
    totalPoints: number;
    leveledUp: boolean;
    previousLevel?: string;
    nextLevel?: {
        name: string;
        pointsRequired: number;
        pointsRemaining: number;
        progressPercentage: number;
    };
}

export interface BadgeUnlockResult {
    badgeId: string;
    badgeName: string;
    category: string;
    pointsAwarded: number;
    unlockedAt: Date;
}

export interface ChallengeUpdateResult {
    challengeId: string;
    challengeName: string;
    status: 'IN_PROGRESS' | 'COMPLETED';
    progressCount: number;
    targetCount: number;
    completed: boolean;
    pointsAwarded?: number;
    badgeAwarded?: string;
}

export interface FidelitySummary {
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
            unlockedAt: Date;
        }>;
    };
    activeChallenges: number;
    suggestedActions: Array<{
        actionKey: string;
        displayName: string;
        points: number;
        description?: string;
    }>;
}

export interface UserBadgesView {
    unlocked: Array<{
        id: string;
        badgeId: string;
        name: string;
        description?: string;
        category: string;
        iconKey?: string;
        color?: string;
        unlockedAt: Date;
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
}

export interface UserChallengesView {
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
        expiresAt?: Date;
        iconKey?: string;
        color?: string;
    }>;
    completed: Array<{
        id: string;
        challengeId: string;
        name: string;
        completedAt: Date;
        pointsAwarded: number;
        badgeAwarded: boolean;
    }>;
}

// ============================================
// DOMAIN EVENTS
// ============================================

export interface FidelityEvent {
    type: FidelityEventType;
    userId: string;
    timestamp: Date;
    payload: Record<string, any>;
    idempotencyKey?: string;
}

export type FidelityEventType =
    | 'RESERVATION_CREATED'
    | 'RESERVATION_CHECKED_IN'
    | 'REVIEW_CREATED'
    | 'USER_INVITE_COMPLETED'
    | 'VENUE_VISITED_FIRST_TIME'
    | 'PROFILE_COMPLETED'
    | 'APP_SHARED';

export interface FidelityEventResult {
    pointsAwarded: number;
    newLevel?: LevelResult;
    badgesUnlocked: BadgeUnlockResult[];
    challengesUpdated: ChallengeUpdateResult[];
}
