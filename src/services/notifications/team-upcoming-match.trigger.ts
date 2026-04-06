import { db } from "../../config/config.db";
import { eq, and, isNotNull, or, gte, lt } from "drizzle-orm";
import { matchesTable } from "../../config/db/matches.table";
import { userTeamFollowsTable } from "../../config/db/user-team-follows.table";
import { usersTable } from "../../config/db/user.table";
import { teamsTable } from "../../config/db/sports.table";
import { notificationQueue } from "../../queue/notification.queue";
import { NotificationType } from "../../types/jobs.type";
import { v4 as uuidv4 } from "uuid";

/**
 * Checks for matches starting in exactly the next 23 to 24 hours.
 * Notifies users who follow either the home or away team.
 */
export async function triggerUpcomingMatchNotifications() {
    console.log("[TeamUpcomingMatchTrigger] Checking for upcoming matches...");
    
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    // 1. Fetch matches starting within the next 23 to 24 hours
    const upcomingMatches = await db
        .select({
            matchId: matchesTable.id,
            homeTeamId: matchesTable.home_team_id,
            awayTeamId: matchesTable.away_team_id,
            scheduledAt: matchesTable.scheduled_at,
        })
        .from(matchesTable)
        .where(
            and(
                gte(matchesTable.scheduled_at, windowStart),
                lt(matchesTable.scheduled_at, windowEnd),
                eq(matchesTable.status, "scheduled")
            )
        );

    if (upcomingMatches.length === 0) {
        console.log("[TeamUpcomingMatchTrigger] No upcoming matches found in the 23-24h window.");
        return;
    }

    console.log(`[TeamUpcomingMatchTrigger] Found ${upcomingMatches.length} upcoming matches.`);

    // 2. Fetch users following either team and with a valid push token
    for (const match of upcomingMatches) {
        const followers = await db
            .select({
                userId: usersTable.id,
                pushToken: usersTable.push_token,
                teamName: teamsTable.name,
                teamId: teamsTable.id,
            })
            .from(userTeamFollowsTable)
            .innerJoin(usersTable, eq(usersTable.id, userTeamFollowsTable.user_id))
            .innerJoin(teamsTable, eq(teamsTable.id, userTeamFollowsTable.team_id))
            .where(
                and(
                    or(
                        eq(userTeamFollowsTable.team_id, match.homeTeamId),
                        eq(userTeamFollowsTable.team_id, match.awayTeamId)
                    ),
                    isNotNull(usersTable.push_token)
                )
            );

        if (followers.length === 0) continue;

        console.log(`[TeamUpcomingMatchTrigger] Found ${followers.length} followers to notify for match ${match.matchId}.`);

        // 3. Dispatch notifications
        for (const follower of followers) {
            if (!follower.pushToken) continue;

            const title = "Match Day!";
            const body = `Your team ${follower.teamName} is playing soon! What about you find the best place to watch them?`;

            await notificationQueue.add(
                "send_push",
                {
                    type: NotificationType.PUSH,
                    recipientId: follower.userId,
                    traceId: uuidv4(),
                    data: {
                        tokens: [follower.pushToken],
                        title,
                        body,
                        data: {
                            type: "upcoming_match",
                            matchId: match.matchId,
                            teamId: follower.teamId,
                        },
                    },
                },
                {
                    removeOnComplete: true,
                    attempts: 3,
                    backoff: { type: "exponential", delay: 1000 },
                }
            );
        }
    }

    console.log("[TeamUpcomingMatchTrigger] Finished scheduling notifications.");
}
