import { db } from "../../config/config.db";
import { eq, and, isNotNull, or, gte, lt, inArray } from "drizzle-orm";
import { matchesTable } from "../../config/db/matches.table";
import { userTeamFollowsTable } from "../../config/db/user-team-follows.table";
import { usersTable } from "../../config/db/user.table";
import { teamsTable } from "../../config/db/sports.table";
import { notificationLogsTable } from "../../config/db/notification-logs.table";
import { notificationQueue } from "../../queue/notification.queue";
import { NotificationType } from "../../types/jobs.type";
import { v4 as uuidv4 } from "uuid";

/**
 * Checks for matches starting in the next 24 and 48 hours.
 * Notifies users who follow either the home or away team.
 * Uses a notification_logs table to ensure idempotency.
 */
export async function triggerUpcomingMatchNotifications() {
    console.log("[TeamUpcomingMatchTrigger] Checking for upcoming matches...");
    
    const now = new Date();
    
    // Windows are widened to ensure no matches are missed if the cron job is slightly delayed.
    // Idempotency is handled by the notification_logs table.
    const windows = [
        { 
            label: "24h", 
            start: new Date(now.getTime() + 22 * 60 * 60 * 1000), 
            end: new Date(now.getTime() + 26 * 60 * 60 * 1000),
        },
        { 
            label: "48h", 
            start: new Date(now.getTime() + 46 * 60 * 60 * 1000), 
            end: new Date(now.getTime() + 50 * 60 * 60 * 1000),
        }
    ];


    for (const window of windows) {
        console.log(`[TeamUpcomingMatchTrigger] Checking ${window.label} window (${window.start.toISOString()} to ${window.end.toISOString()})...`);

        // 1. Fetch matches starting within the window
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
                    gte(matchesTable.scheduled_at, window.start),
                    lt(matchesTable.scheduled_at, window.end),
                    eq(matchesTable.status, "scheduled")
                )
            );

        if (upcomingMatches.length === 0) {
            console.log(`[TeamUpcomingMatchTrigger] No upcoming matches found in the ${window.label} window.`);
            continue;
        }

        console.log(`[TeamUpcomingMatchTrigger] Found ${upcomingMatches.length} matches in the ${window.label} window.`);

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

            // 3. Dispatch notifications if not already sent
            for (const follower of followers) {
                if (!follower.pushToken) continue;

                // Check idempotency log
                const existingLog = await db
                    .select({ id: notificationLogsTable.id })
                    .from(notificationLogsTable)
                    .where(
                        and(
                            eq(notificationLogsTable.user_id, follower.userId),
                            eq(notificationLogsTable.match_id, match.matchId),
                            eq(notificationLogsTable.notification_type, `upcoming_match_${window.label}`)
                        )
                    )
                    .limit(1);

                if (existingLog.length > 0) {
                    // Already sent for this window
                    continue;
                }

                const title = window.label === "24h" ? "Match Day!" : "Upcoming Match!";
                const body = window.label === "24h" 
                    ? `Your team ${follower.teamName} is playing soon! What about you find the best place to watch them?`
                    : `Your team ${follower.teamName} is playing in 2 days! Don't forget to book your spot.`;

                await notificationQueue.add(
                    "send_push",
                    {
                        type: NotificationType.PUSH_NOTIFICATION,
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
                                window: window.label,
                            },
                        },
                    },
                    {
                        removeOnComplete: true,
                        attempts: 3,
                        backoff: { type: "exponential", delay: 1000 },
                    }
                );

                // Log the notification to prevent duplicates
                await db.insert(notificationLogsTable).values({
                    user_id: follower.userId,
                    match_id: match.matchId,
                    notification_type: `upcoming_match_${window.label}`,
                }).onConflictDoNothing();
            }
        }
    }

    console.log("[TeamUpcomingMatchTrigger] Finished scheduling notifications.");
}
