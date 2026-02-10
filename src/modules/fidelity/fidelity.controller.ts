import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { fidelityRepository } from "../../repository/fidelity.repository";
import type {
    PointsAwardContext,
    PointsResult,
    LevelResult,
    BadgeUnlockResult,
    ChallengeUpdateResult,
    FidelitySummary,
    UserBadgesView,
    UserChallengesView,
    FidelityEvent,
    FidelityEventResult,
    FidelityActionKey,
} from "./fidelity.types";

// ============================================
// FIDELITY SERVICE FUNCTIONS
// ============================================

/**
 * Award points for an action
 */
async function awardPoints(context: PointsAwardContext): Promise<PointsResult> {
    const { userId, actionKey, referenceId, referenceType, metadata } = context;

    // Check if points already awarded (idempotency)
    const existing = await fidelityRepository.getPointTransaction(userId, actionKey, referenceId);
    if (existing) {
        return {
            success: false,
            pointsAwarded: 0,
            newTotalPoints: await fidelityRepository.getUserTotalPoints(userId),
            reason: "Points already awarded for this action",
        };
    }

    // Get the point rule
    const rule = await fidelityRepository.getPointRule(actionKey);
    if (!rule) {
        return {
            success: false,
            pointsAwarded: 0,
            newTotalPoints: await fidelityRepository.getUserTotalPoints(userId),
            reason: `No point rule found for action: ${actionKey}`,
        };
    }

    // Check daily cap
    if (rule.max_per_day) {
        const todayCount = await fidelityRepository.getUserActionCountToday(userId, actionKey);
        if (todayCount >= rule.max_per_day) {
            return {
                success: false,
                pointsAwarded: 0,
                newTotalPoints: await fidelityRepository.getUserTotalPoints(userId),
                reason: "Daily limit reached for this action",
            };
        }
    }

    // Check conditions
    const conditions = rule.conditions as any;
    if (conditions) {
        // Add condition checks here as needed
        // e.g., only_first_per_venue, min_review_length, etc.
    }

    // Create the transaction
    const transaction = await fidelityRepository.createPointTransaction({
        user_id: userId,
        action_key: actionKey,
        reference_id: referenceId,
        reference_type: referenceType,
        points: rule.base_points,
        description: rule.display_name,
        metadata: metadata as any,
        idempotency_key: `${userId}:${actionKey}:${referenceId}`,
    });

    // Update user stats
    await fidelityRepository.upsertUserStats(userId, {
        total_points: await fidelityRepository.getUserTotalPoints(userId),
        last_activity_date: new Date(),
    });

    // Log the event
    await fidelityRepository.logEvent({
        user_id: userId,
        event_type: "POINTS_EARNED",
        details: {
            points_earned: rule.base_points,
            action_key: actionKey,
            reference_id: referenceId,
        },
    });

    return {
        success: true,
        pointsAwarded: rule.base_points,
        newTotalPoints: await fidelityRepository.getUserTotalPoints(userId),
        transactionId: transaction.id,
    };
}

/**
 * Recalculate user level based on total points
 */
async function recalculateUserLevel(userId: string): Promise<LevelResult> {
    const totalPoints = await fidelityRepository.getUserTotalPoints(userId);
    const currentLevel = await fidelityRepository.getLevelForPoints(totalPoints);
    const nextLevel = await fidelityRepository.getNextLevel(totalPoints);

    if (!currentLevel) {
        // Return default level
        return {
            levelId: "",
            levelName: "Rookie",
            levelRank: 0,
            totalPoints,
            leveledUp: false,
        };
    }

    // Get user stats to check if level changed
    const stats = await fidelityRepository.getUserStats(userId);
    const previousLevelId = stats?.current_level_id;
    const leveledUp = previousLevelId !== currentLevel.id;

    // Update user stats with new level
    await fidelityRepository.upsertUserStats(userId, {
        current_level_id: currentLevel.id,
        total_points: totalPoints,
    });

    // Log level up if it happened
    if (leveledUp && previousLevelId) {
        const previousLevel = await fidelityRepository.getLevelById(previousLevelId);
        await fidelityRepository.logEvent({
            user_id: userId,
            event_type: "LEVEL_UP",
            details: {
                old_level: previousLevel?.name,
                new_level: currentLevel.name,
                total_points: totalPoints,
            },
        });
    }

    const result: LevelResult = {
        levelId: currentLevel.id,
        levelName: currentLevel.name,
        levelRank: currentLevel.rank,
        totalPoints,
        leveledUp,
    };

    if (nextLevel) {
        const pointsRemaining = nextLevel.min_points - totalPoints;
        const progressRange = nextLevel.min_points - currentLevel.min_points;
        const currentProgress = totalPoints - currentLevel.min_points;

        result.nextLevel = {
            name: nextLevel.name,
            pointsRequired: nextLevel.min_points,
            pointsRemaining,
            progressPercentage: Math.min(100, Math.round((currentProgress / progressRange) * 100)),
        };
    }

    return result;
}

/**
 * Check and unlock badges based on user stats
 */
async function checkAndUnlockBadges(
    userId: string,
    actionKey: string,
    metadata?: Record<string, any>
): Promise<BadgeUnlockResult[]> {
    const unlockedBadges: BadgeUnlockResult[] = [];
    const allBadges = await fidelityRepository.getAllBadges();
    const userStats = await fidelityRepository.getUserStats(userId);

    for (const badge of allBadges) {
        // Skip if already unlocked
        const hasIt = await fidelityRepository.hasUserBadge(userId, badge.id);
        if (hasIt) continue;

        const conditions = badge.unlock_conditions as any;
        if (!conditions) continue;

        let shouldUnlock = false;

        switch (conditions.type) {
            case "COUNT":
                if (conditions.action_key === actionKey) {
                    const field = getStatFieldForAction(conditions.action_key);
                    if (field && userStats) {
                        const count = (userStats as any)[field] ?? 0;
                        shouldUnlock = count >= (conditions.target_count ?? 1);
                    }
                }
                break;

            case "DISTINCT_COUNT":
                // Would need to query distinct values from transactions
                break;

            case "POINTS":
                if (userStats && conditions.min_points) {
                    shouldUnlock = userStats.total_points >= conditions.min_points;
                }
                break;

            case "LEVEL":
                if (userStats?.current_level_id && conditions.min_level_rank) {
                    const level = await fidelityRepository.getLevelById(userStats.current_level_id);
                    shouldUnlock = (level?.rank ?? 0) >= conditions.min_level_rank;
                }
                break;
        }

        if (shouldUnlock) {
            const userBadge = await fidelityRepository.unlockBadge({
                user_id: userId,
                badge_id: badge.id,
                source_event_type: actionKey,
                points_awarded: badge.reward_points ?? 0,
            });

            // Award bonus points for badge
            if (badge.reward_points && badge.reward_points > 0) {
                await fidelityRepository.createPointTransaction({
                    user_id: userId,
                    action_key: "BADGE_UNLOCK_BONUS",
                    reference_id: badge.id,
                    reference_type: "badge",
                    points: badge.reward_points,
                    description: `Badge unlocked: ${badge.name}`,
                });
            }

            // Log the event
            await fidelityRepository.logEvent({
                user_id: userId,
                event_type: "BADGE_UNLOCKED",
                details: {
                    badge_name: badge.name,
                    badge_category: badge.category,
                    points_awarded: badge.reward_points,
                },
            });

            unlockedBadges.push({
                badgeId: badge.id,
                badgeName: badge.name,
                category: badge.category,
                pointsAwarded: badge.reward_points ?? 0,
                unlockedAt: userBadge.unlocked_at,
            });
        }
    }

    return unlockedBadges;
}

/**
 * Update challenge progress based on action
 */
async function updateChallenges(
    userId: string,
    actionKey: string,
    metadata?: Record<string, any>
): Promise<ChallengeUpdateResult[]> {
    const results: ChallengeUpdateResult[] = [];
    const challenges = await fidelityRepository.getChallengesByActionKey(actionKey);

    for (const challenge of challenges) {
        // Get or create user challenge
        let userChallenge = await fidelityRepository.getUserActiveChallenge(userId, challenge.id);

        if (!userChallenge) {
            // Create a new user challenge entry
            const expiresAt = challenge.duration_days
                ? new Date(Date.now() + challenge.duration_days * 24 * 60 * 60 * 1000)
                : challenge.end_at;

            userChallenge = await fidelityRepository.createUserChallenge({
                user_id: userId,
                challenge_id: challenge.id,
                status: "IN_PROGRESS",
                progress_count: 0,
                started_at: new Date(),
                expires_at: expiresAt,
            });
        }

        // Skip if already completed
        if (userChallenge.status === "COMPLETED") continue;

        // Increment progress
        const newProgress = (userChallenge.progress_count ?? 0) + 1;
        const completed = newProgress >= challenge.target_count;

        const updates: any = {
            progress_count: newProgress,
            status: completed ? "COMPLETED" : "IN_PROGRESS",
        };

        if (completed) {
            updates.completed_at = new Date();
            updates.points_awarded = challenge.reward_points;

            // Award challenge completion points
            if (challenge.reward_points > 0) {
                await fidelityRepository.createPointTransaction({
                    user_id: userId,
                    action_key: "CHALLENGE_COMPLETED",
                    reference_id: challenge.id,
                    reference_type: "challenge",
                    points: challenge.reward_points,
                    description: `Challenge completed: ${challenge.name}`,
                });
            }

            // Award badge if specified
            if (challenge.reward_badge_id) {
                const hasBadge = await fidelityRepository.hasUserBadge(userId, challenge.reward_badge_id);
                if (!hasBadge) {
                    await fidelityRepository.unlockBadge({
                        user_id: userId,
                        badge_id: challenge.reward_badge_id,
                        source_event_type: "CHALLENGE_COMPLETED",
                        source_event_id: challenge.id,
                    });
                    updates.badge_awarded = true;
                }
            }

            // Log completion
            await fidelityRepository.logEvent({
                user_id: userId,
                event_type: "CHALLENGE_COMPLETED",
                details: {
                    challenge_name: challenge.name,
                    points_awarded: challenge.reward_points,
                    badge_awarded: !!challenge.reward_badge_id,
                },
            });
        }

        await fidelityRepository.updateUserChallenge(userChallenge.id, updates);

        results.push({
            challengeId: challenge.id,
            challengeName: challenge.name,
            status: completed ? "COMPLETED" : "IN_PROGRESS",
            progressCount: newProgress,
            targetCount: challenge.target_count,
            completed,
            pointsAwarded: completed ? challenge.reward_points : undefined,
            badgeAwarded: completed && challenge.reward_badge_id ? challenge.name : undefined,
        });
    }

    return results;
}

/**
 * Get user fidelity summary
 */
async function getFidelitySummary(userId: string): Promise<FidelitySummary> {
    const stats = await fidelityRepository.getUserStats(userId);
    const totalPoints = stats?.total_points ?? (await fidelityRepository.getUserTotalPoints(userId));

    // Get level info
    const currentLevel = stats?.current_level_id
        ? await fidelityRepository.getLevelById(stats.current_level_id)
        : await fidelityRepository.getLevelForPoints(totalPoints);

    const nextLevel = await fidelityRepository.getNextLevel(totalPoints);

    // Calculate period points
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const monthPoints = await fidelityRepository.getUserPointsInPeriod(userId, startOfMonth, now);
    const weekPoints = await fidelityRepository.getUserPointsInPeriod(userId, startOfWeek, now);

    // Get badges
    const userBadges = await fidelityRepository.getUserBadges(userId);
    const recentBadges = userBadges.slice(0, 3);
    const badgeDetails = await Promise.all(
        recentBadges.map(async (ub) => {
            const badge = await fidelityRepository.getBadgeById(ub.badge_id);
            return {
                id: ub.id,
                name: badge?.name ?? "Badge",
                iconKey: badge?.icon_key ?? undefined,
                unlockedAt: ub.unlocked_at,
            };
        })
    );

    // Get active challenges count
    const userChallenges = await fidelityRepository.getUserChallenges(userId);
    const activeChallenges = userChallenges.filter(
        (c) => c.status === "IN_PROGRESS" || c.status === "NOT_STARTED"
    ).length;

    // Get suggested actions
    const pointRules = await fidelityRepository.getAllPointRules();
    const suggestedActions = pointRules.slice(0, 3).map((rule) => ({
        actionKey: rule.action_key,
        displayName: rule.display_name,
        points: rule.base_points,
        description: rule.description ?? undefined,
    }));

    // Calculate progress
    let progressPercentage = 100;
    let pointsToNextLevel = 0;
    if (nextLevel && currentLevel) {
        pointsToNextLevel = nextLevel.min_points - totalPoints;
        const range = nextLevel.min_points - currentLevel.min_points;
        const current = totalPoints - currentLevel.min_points;
        progressPercentage = Math.min(100, Math.round((current / range) * 100));
    }

    return {
        level: {
            id: currentLevel?.id ?? "",
            name: currentLevel?.name ?? "Rookie",
            rank: currentLevel?.rank ?? 0,
            color: currentLevel?.color ?? undefined,
            iconKey: currentLevel?.icon_key ?? undefined,
        },
        points: {
            total: totalPoints,
            thisMonth: monthPoints,
            thisWeek: weekPoints,
        },
        progress: {
            pointsToNextLevel,
            progressPercentage,
            nextLevelName: nextLevel?.name,
        },
        stats: {
            totalReservations: stats?.total_reservations ?? 0,
            totalCheckIns: stats?.total_check_ins ?? 0,
            totalReviews: stats?.total_reviews ?? 0,
            totalVenuesVisited: stats?.total_venues_visited ?? 0,
            currentStreak: stats?.current_streak_days ?? 0,
        },
        badges: {
            total: userBadges.length,
            recent: badgeDetails,
        },
        activeChallenges,
        suggestedActions,
    };
}

/**
 * Get user badges (unlocked and locked)
 */
async function getUserBadges(userId: string): Promise<UserBadgesView> {
    const allBadges = await fidelityRepository.getAllBadges();
    const userBadges = await fidelityRepository.getUserBadges(userId);
    const userStats = await fidelityRepository.getUserStats(userId);

    const unlockedIds = new Set(userBadges.map((ub) => ub.badge_id));

    const unlocked = userBadges
        .map((ub) => {
            const badge = allBadges.find((b) => b.id === ub.badge_id);
            return {
                id: ub.id,
                badgeId: ub.badge_id,
                name: badge?.name ?? "Badge",
                description: badge?.description ?? undefined,
                category: badge?.category ?? "ACTIVITY",
                iconKey: badge?.icon_key ?? undefined,
                color: badge?.color ?? undefined,
                unlockedAt: ub.unlocked_at,
                pointsAwarded: ub.points_awarded ?? 0,
            };
        });

    const locked = allBadges
        .filter((b) => !unlockedIds.has(b.id))
        .map((badge) => {
            const conditions = badge.unlock_conditions as any;
            let progress;

            if (conditions?.type === "COUNT" && conditions.target_count && userStats) {
                const field = getStatFieldForAction(conditions.action_key);
                if (field) {
                    const current = (userStats as any)[field] ?? 0;
                    progress = {
                        current,
                        target: conditions.target_count,
                        percentage: Math.min(100, Math.round((current / conditions.target_count) * 100)),
                    };
                }
            }

            return {
                id: badge.id,
                name: badge.name,
                description: badge.is_secret ? undefined : badge.description ?? undefined,
                category: badge.category,
                iconKey: badge.icon_key ?? undefined,
                isSecret: badge.is_secret ?? false,
                progress,
            };
        });

    return { unlocked, locked };
}

/**
 * Get user challenges
 */
async function getUserChallenges(userId: string): Promise<UserChallengesView> {
    const userChallenges = await fidelityRepository.getUserChallenges(userId);
    const allChallenges = await fidelityRepository.getActiveChallenges();

    const active = userChallenges
        .filter((uc) => uc.status === "IN_PROGRESS" || uc.status === "NOT_STARTED")
        .map((uc) => {
            const challenge = allChallenges.find((c) => c.id === uc.challenge_id);
            const progressPercentage = challenge
                ? Math.min(100, Math.round((uc.progress_count / challenge.target_count) * 100))
                : 0;

            return {
                id: uc.id,
                challengeId: uc.challenge_id,
                name: challenge?.name ?? "Challenge",
                description: challenge?.description ?? undefined,
                status: uc.status,
                progressCount: uc.progress_count,
                targetCount: challenge?.target_count ?? 1,
                progressPercentage,
                rewardPoints: challenge?.reward_points ?? 0,
                rewardBadge: challenge?.reward_badge_id ?? undefined,
                expiresAt: uc.expires_at ?? undefined,
                iconKey: challenge?.icon_key ?? undefined,
                color: challenge?.color ?? undefined,
            };
        });

    const completed = userChallenges
        .filter((uc) => uc.status === "COMPLETED")
        .map((uc) => {
            const challenge = allChallenges.find((c) => c.id === uc.challenge_id);
            return {
                id: uc.id,
                challengeId: uc.challenge_id,
                name: challenge?.name ?? "Challenge",
                completedAt: uc.completed_at ?? new Date(),
                pointsAwarded: uc.points_awarded ?? 0,
                badgeAwarded: uc.badge_awarded ?? false,
            };
        });

    return { active, completed };
}

/**
 * Process a fidelity event (main entry point)
 */
async function handleFidelityEvent(event: FidelityEvent): Promise<FidelityEventResult> {
    const { type, userId, payload } = event;

    // Map event type to action key
    const actionKey = mapEventToAction(type);
    if (!actionKey) {
        return {
            pointsAwarded: 0,
            badgesUnlocked: [],
            challengesUpdated: [],
        };
    }

    // Award points
    const pointsResult = await awardPoints({
        userId,
        actionKey,
        referenceId: payload.referenceId ?? payload.id ?? `${type}-${Date.now()}`,
        referenceType: payload.referenceType ?? type.toLowerCase(),
        metadata: payload,
    });

    // Update user stats based on action
    await updateUserStatsForAction(userId, actionKey, payload);

    // Recalculate level
    const levelResult = await recalculateUserLevel(userId);

    // Check badges
    const badgesUnlocked = await checkAndUnlockBadges(userId, actionKey, payload);

    // Update challenges
    const challengesUpdated = await updateChallenges(userId, actionKey, payload);

    return {
        pointsAwarded: pointsResult.pointsAwarded,
        newLevel: levelResult.leveledUp ? levelResult : undefined,
        badgesUnlocked,
        challengesUpdated,
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapEventToAction(eventType: string): FidelityActionKey | null {
    const map: Record<string, FidelityActionKey> = {
        RESERVATION_CREATED: "BOOK_RESERVATION",
        RESERVATION_CHECKED_IN: "CHECK_IN",
        REVIEW_CREATED: "CREATE_REVIEW",
        USER_INVITE_COMPLETED: "INVITE_COMPLETED",
        VENUE_VISITED_FIRST_TIME: "FIRST_VENUE_VISIT",
        PROFILE_COMPLETED: "PROFILE_COMPLETED",
        APP_SHARED: "SHARE_APP",
    };
    return map[eventType] ?? null;
}

function getStatFieldForAction(actionKey: string): string | null {
    const map: Record<string, string> = {
        BOOK_RESERVATION: "total_reservations",
        CHECK_IN: "total_check_ins",
        CREATE_REVIEW: "total_reviews",
        FIRST_VENUE_VISIT: "total_venues_visited",
        INVITE_COMPLETED: "total_invites_completed",
    };
    return map[actionKey] ?? null;
}

async function updateUserStatsForAction(
    userId: string,
    actionKey: string,
    payload: Record<string, any>
): Promise<void> {
    const field = getStatFieldForAction(actionKey);
    if (field) {
        await fidelityRepository.incrementUserStat(userId, field as any, 1);
    }
}

// ============================================
// HONO CONTROLLER
// ============================================

class FidelityController {
    private readonly factory = createFactory<HonoEnv>();

    /**
     * GET /api/fidelity/summary
     */
    public readonly getSummary = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) {
                return c.json({ error: "Unauthorized" }, 401);
            }
            const userId = user.id;

            const summary = await getFidelitySummary(userId);
            return c.json({ data: summary });
        } catch (error: any) {
            console.error("Error getting fidelity summary:", error);
            return c.json({ error: "Failed to get fidelity summary" }, 500);
        }
    });

    /**
     * GET /api/fidelity/points-history
     */
    public readonly getPointsHistory = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const { limit = "50", offset = "0" } = c.req.query();
            const transactions = await fidelityRepository.getUserPointTransactions(
                user.id,
                parseInt(limit),
                parseInt(offset)
            );

            const history = transactions.map((t) => ({
                id: t.id,
                date: t.created_at,
                actionKey: t.action_key,
                description: t.description,
                points: t.points,
                referenceType: t.reference_type,
            }));

            return c.json({ data: history, count: history.length });
        } catch (error: any) {
            console.error("Error getting points history:", error);
            return c.json({ error: "Failed to get points history" }, 500);
        }
    });

    /**
     * GET /api/fidelity/badges
     */
    public readonly getBadges = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const badges = await getUserBadges(user.id);
            return c.json({ data: badges });
        } catch (error: any) {
            console.error("Error getting badges:", error);
            return c.json({ error: "Failed to get badges" }, 500);
        }
    });

    /**
     * GET /api/fidelity/challenges
     */
    public readonly getChallenges = this.factory.createHandlers(async (c) => {
        try {
            const user = c.get("user");
            if (!user?.id) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const challenges = await getUserChallenges(user.id);
            return c.json({ data: challenges });
        } catch (error: any) {
            console.error("Error getting challenges:", error);
            return c.json({ error: "Failed to get challenges" }, 500);
        }
    });

    /**
     * GET /api/fidelity/levels
     */
    public readonly getLevels = this.factory.createHandlers(async (c) => {
        try {
            const levels = await fidelityRepository.getAllLevels();
            return c.json({ data: levels });
        } catch (error: any) {
            console.error("Error getting levels:", error);
            return c.json({ error: "Failed to get levels" }, 500);
        }
    });
}

export default FidelityController;
export {
    awardPoints,
    recalculateUserLevel,
    checkAndUnlockBadges,
    updateChallenges,
    getFidelitySummary,
    getUserBadges,
    getUserChallenges,
    handleFidelityEvent,
};
