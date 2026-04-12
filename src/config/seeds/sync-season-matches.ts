/**
 * Optimized Sync Season Matches Seed Script
 *
 * Fetches ALL matches for the current season for major leagues.
 * Optimized to minimize both API calls and Database queries.
 *
 * Usage:
 *   bun --env-file=.env.dev run src/config/seeds/sync-season-matches.ts
 */

import { SportsRepository } from "../../repository/sports.repository";
import { apiSports } from "../../lib/api-sports";
import { db } from "../config.db";
import { leaguesTable, teamsTable } from "../db/sports.table";

// Strictly limited to major European leagues and international competitions
const MAJOR_LEAGUE_IDS = new Set([
    // World / Continental
    1,   // World Cup
    2,   // Champions League
    3,   // Europa League
    4,   // Euro Championship
    848, // Conference League

    // England
    39,  // Premier League
    40,  // Championship
    45,  // FA Cup
    48,  // EFL Cup

    // Italy
    135, // Serie A
    136, // Serie B
    137, // Coppa Italia

    // Spain
    140, // La Liga
    141, // La Liga 2
    143, // Copa del Rey

    // Germany
    78,  // Bundesliga
    79,  // 2. Bundesliga
    81,  // DFB Pokal

    // France
    61,  // Ligue 1
    62,  // Ligue 2
    66,  // Coupe de France
    65,  // Coupe de la Ligue

    // Netherlands
    88,  // Eredivisie
    89,  // Eerste Divisie
    90,  // KNVB Beker
]);

function getCurrentSeason(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return month >= 7 ? String(year) : String(year - 1);
}

function getFromDate(): string {
    return new Date().toISOString().split("T")[0]!;
}

function getToDate(): string {
    const now = new Date();
    // If we are past August (month index 7), go to next year's August 31st
    const year = now.getMonth() > 7 ? now.getFullYear() + 1 : now.getFullYear();
    return `${year}-08-31`;
}

async function sync() {
    if (!process.env.API_SPORTS_KEY) {
        console.error("ERROR: API_SPORTS_KEY is not set.");
        process.exit(1);
    }

    const repo = new SportsRepository();
    const season = getCurrentSeason();
    const fromDate = getFromDate();
    const toDate = getToDate();

    console.log(`\n🚀 Optimized API-Sports Season Sync`);
    console.log(`Season: ${season} | Leagues: ${MAJOR_LEAGUE_IDS.size}`);
    console.log(`Date Range: ${fromDate} to ${toDate}\n`);

    const sportId = await repo.getOrCreateFootballSport();

    // 1. PRE-LOAD CACHE (The biggest DB optimization)
    console.log("📥 Pre-loading local cache from database...");
    const teamCache = new Map<number, string>();
    const leagueCache = new Map<number, string>();

    const existingLeagues = await db
        .select({ id: leaguesTable.id, apiId: leaguesTable.api_id })
        .from(leaguesTable);
    existingLeagues.forEach((l) => l.apiId && leagueCache.set(l.apiId, l.id));

    const existingTeams = await db
        .select({ id: teamsTable.id, apiId: teamsTable.api_id })
        .from(teamsTable);
    existingTeams.forEach((t) => t.apiId && teamCache.set(t.apiId, t.id));

    console.log(
        `   Cached ${leagueCache.size} leagues and ${teamCache.size} teams.\n`,
    );

    const processedTeamLeagues = new Set<string>();
    let totalMatches = 0;
    let totalErrors = 0;
    let leagueCount = 0;

    for (const apiLeagueId of MAJOR_LEAGUE_IDS) {
        try {
            console.log(
                `[${++leagueCount}/${MAJOR_LEAGUE_IDS.size}] Syncing League ${apiLeagueId}...`,
            );

            // 2. FETCH FIXTURES (1 call per league for the date range)
            const result = await apiSports.getFixtures({
                league: String(apiLeagueId),
                season,
                from: fromDate,
                to: toDate,
            });

            if (result.results === 0) {
                console.log(`   ⚠️ No fixtures found.`);
                continue;
            }

            // 3. ENSURE LEAGUE METADATA EXISTS
            let leagueInternalId = leagueCache.get(apiLeagueId);
            if (!leagueInternalId) {
                console.log(
                    `   🔍 League ${apiLeagueId} not in DB. Fetching metadata...`,
                );
                const leagueDataList = await apiSports.getLeagues({
                    id: String(apiLeagueId),
                });
                if (leagueDataList.response.length > 0) {
                    leagueInternalId = await repo.upsertLeagueFromApi(
                        sportId,
                        leagueDataList.response[0]!,
                        true,
                    );
                    leagueCache.set(apiLeagueId, leagueInternalId);
                } else {
                    console.error(
                        `   x Could not resolve league ${apiLeagueId}. Skipping.`,
                    );
                    continue;
                }
            }

            // 4. PROCESS FIXTURES
            let fixtureCount = 0;
            for (const fixture of result.response) {
                try {
                    fixtureCount++;
                    if (
                        fixtureCount % 50 === 0 ||
                        fixtureCount === 1 ||
                        fixtureCount === result.results
                    ) {
                        process.stdout.write(
                            `   Syncing matches: ${fixtureCount}/${result.results}\r`,
                        );
                    }

                    // We update the team if it's not in cache OR if we haven't processed this team-league combo yet.
                    // This ensures teams that participate in multiple leagues are properly updated.
                    const homeTeamKey = `${fixture.teams.home.id}-${apiLeagueId}`;
                    let homeId = teamCache.get(fixture.teams.home.id);

                    if (!homeId || !processedTeamLeagues.has(homeTeamKey)) {
                        homeId = await repo.upsertTeamFromApi(
                            leagueInternalId,
                            {
                                team: {
                                    ...fixture.teams.home,
                                    country: fixture.league.country,
                                    code: null,
                                    founded: null,
                                    national: false,
                                },
                                venue: null,
                            },
                        );
                        teamCache.set(fixture.teams.home.id, homeId);
                        processedTeamLeagues.add(homeTeamKey);
                    }

                    const awayTeamKey = `${fixture.teams.away.id}-${apiLeagueId}`;
                    let awayId = teamCache.get(fixture.teams.away.id);

                    if (!awayId || !processedTeamLeagues.has(awayTeamKey)) {
                        awayId = await repo.upsertTeamFromApi(
                            leagueInternalId,
                            {
                                team: {
                                    ...fixture.teams.away,
                                    country: fixture.league.country,
                                    code: null,
                                    founded: null,
                                    national: false,
                                },
                                venue: null,
                            },
                        );
                        teamCache.set(fixture.teams.away.id, awayId);
                        processedTeamLeagues.add(awayTeamKey);
                    }

                    // Update Match state (scores, rescheduled time, etc)
                    await repo.upsertMatchFromApi(
                        fixture,
                        leagueInternalId,
                        homeId,
                        awayId,
                    );
                    totalMatches++;
                } catch (err) {
                    totalErrors++;
                }
            }
            process.stdout.write("\n   ✅ Done.\n");
        } catch (err: any) {
            console.error(`   x League ${apiLeagueId} Failed: ${err.message}`);
        }
    }

    console.log("\n========================================");
    console.log(`🏁 Season Sync Completed: ${totalMatches} matches updated.`);
    if (totalErrors > 0)
        console.log(`⚠️ Note: ${totalErrors} fixtures had minor errors.`);
    console.log("========================================\n");
}

sync()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
