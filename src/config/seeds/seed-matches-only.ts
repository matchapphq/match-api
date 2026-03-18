/**
 * Seed script — fetches ONLY matches (fixtures) from API-Sports by date.
 * 
 * Assumes Sports, Countries, Leagues, and Teams are already seeded.
 * If a league or team is missing, the match will be skipped.
 * 
 * Usage:
 *   bun --env-file=.env.dev run src/config/seeds/seed-matches-only.ts
 *   bun --env-file=.env.dev run src/config/seeds/seed-matches-only.ts --date=2024-12-15
 *   bun --env-file=.env.dev run src/config/seeds/seed-matches-only.ts --from=2024-12-01 --to=2024-12-15
 */

import { SportsRepository } from "../../repository/sports.repository";
import { apiSports } from "../../lib/api-sports";

function parseArgs() {
    const args = process.argv.slice(2);
    const parsed: Record<string, string> = {};
    for (const arg of args) {
        const [key, value] = arg.replace(/^--/, "").split("=");
        if (key && value) parsed[key] = value;
    }
    return parsed;
}

function getDateRange(from: string, to: string): string[] {
    const dates: string[] = [];
    const current = new Date(from + "T00:00:00Z");
    const end = new Date(to + "T00:00:00Z");
    while (current <= end) {
        dates.push(current.toISOString().split("T")[0]!);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

async function seed() {
    if (!process.env.API_SPORTS_KEY) {
        console.error("ERROR: API_SPORTS_KEY is not set. Cannot seed from API-Sports.");
        process.exit(1);
    }

    const args = parseArgs();
    const repo = new SportsRepository();
    const now = new Date();
    const today = now.toISOString().split("T")[0]!;
    
    // Default to today only if no range provided
    const fromDate = args.date ?? args.from ?? today;
    const toDate = args.date ?? args.to ?? today;
    const dates = getDateRange(fromDate, toDate);

    console.log(`\nAPI-Sports Match-Only Seed (Dynamic Leagues)`);
    console.log(`Dates: ${dates.join(", ")}`);
    console.log(`(Override: --date=YYYY-MM-DD or --from=YYYY-MM-DD --to=YYYY-MM-DD)\n`);

    let matchCount = 0;
    let matchErrors = 0;
    let skippedCount = 0;

    // Cache internal IDs to avoid redundant DB lookups in the same run
    const leagueMap = new Map<number, string>();
    const teamMap = new Map<number, string>();

    for (const date of dates) {
        try {
            console.log(`Fetching all fixtures for ${date}...`);
            const result = await apiSports.getFixtures({ date });
            console.log(`  ${date}: ${result.results} total fixtures found.`);

            for (const fixture of result.response) {
                try {
                    // 1. Resolve League ID (check if it's a league we track in DB)
                    let leagueId = leagueMap.get(fixture.league.id);
                    if (!leagueId) {
                        const dbLeague = await repo.findLeagueByApiId(fixture.league.id);
                        if (dbLeague) {
                            leagueId = dbLeague.id;
                            leagueMap.set(fixture.league.id, leagueId);
                        }
                    }

                    if (!leagueId) {
                        // Not a league we have in our database, skip
                        skippedCount++;
                        continue;
                    }

                    // 2. Resolve or Create Home Team ID
                    let homeTeamId = teamMap.get(fixture.teams.home.id);
                    if (!homeTeamId) {
                        const dbTeam = await repo.findTeamByApiId(fixture.teams.home.id);
                        if (dbTeam) {
                            homeTeamId = dbTeam.id;
                        } else {
                            // Create team on the fly if missing (useful if we added league but missed teams)
                            homeTeamId = await repo.upsertTeamFromApi(leagueId, {
                                team: {
                                    id: fixture.teams.home.id,
                                    name: fixture.teams.home.name,
                                    code: null,
                                    country: fixture.league.country,
                                    founded: null,
                                    national: false,
                                    logo: fixture.teams.home.logo,
                                },
                                venue: null,
                            });
                        }
                        teamMap.set(fixture.teams.home.id, homeTeamId);
                    }

                    // 3. Resolve or Create Away Team ID
                    let awayTeamId = teamMap.get(fixture.teams.away.id);
                    if (!awayTeamId) {
                        const dbTeam = await repo.findTeamByApiId(fixture.teams.away.id);
                        if (dbTeam) {
                            awayTeamId = dbTeam.id;
                        } else {
                            awayTeamId = await repo.upsertTeamFromApi(leagueId, {
                                team: {
                                    id: fixture.teams.away.id,
                                    name: fixture.teams.away.name,
                                    code: null,
                                    country: fixture.league.country,
                                    founded: null,
                                    national: false,
                                    logo: fixture.teams.away.logo,
                                },
                                venue: null,
                            });
                        }
                        teamMap.set(fixture.teams.away.id, awayTeamId);
                    }

                    // 4. Upsert Match
                    await repo.upsertMatchFromApi(fixture, leagueId, homeTeamId, awayTeamId);
                    matchCount++;
                    console.log(`    + [${fixture.league.name}] ${fixture.teams.home.name} vs ${fixture.teams.away.name} (${fixture.fixture.status.short})`);

                } catch (err: any) {
                    matchErrors++;
                    console.error(`    x Fixture ${fixture.fixture.id}: ${err.message}`);
                }
            }
        } catch (err: any) {
            console.error(`  x Error fetching fixtures for ${date}: ${err.message}`);
        }
    }

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log("\n========================================");
    console.log("Match-Only Seed completed");
    console.log(`  Dates processed: ${dates.length}`);
    console.log(`  Matches seeded:  ${matchCount}`);
    console.log(`  Matches skipped: ${skippedCount} (untracked leagues)`);
    console.log(`  Errors:          ${matchErrors}`);
    console.log("========================================\n");
}

seed()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Seed failed:", err);
        process.exit(1);
    });

