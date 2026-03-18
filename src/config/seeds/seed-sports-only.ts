/**
 * Seed script — fetches ALL data from API-Sports by date.
 * 
 * Seeds in order: Sport → Countries → Leagues → Teams → Matches
 * No season param needed. Uses date-based fixture fetching.
 * 
 * Requires API_SPORTS_KEY to be set.
 * 
 * Usage:
 *   bun --env-file=.env.dev run src/config/seeds/seed-sports-only.ts
 *   bun --env-file=.env.dev run src/config/seeds/seed-sports-only.ts --date=2024-12-15
 *   bun --env-file=.env.dev run src/config/seeds/seed-sports-only.ts --from=2024-12-01 --to=2024-12-15
 */

import { SportsRepository } from "../../repository/sports.repository";
import { apiSports } from "../../lib/api-sports";

// ============================================
// Target Countries for the Major Competitions
// ============================================
const TARGET_COUNTRIES = new Set([
    "England", "Italy", "Spain", "Germany", "France", "Netherlands", "World"
]);

// Mapping of API-Sports league IDs to is_major flag
// Strictly limited to top 2 leagues and major domestic cups for top 6 countries + World/Euro/CL/EL/ECL
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

function getCurrentSeason(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed: 0=Jan, 7=Aug
    // Football seasons usually start around August. 
    // If we are in Feb 2026, the season started in 2025.
    return month >= 7 ? String(year) : String(year - 1);
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
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]!;

    const fromDate = args.date ?? args.from ?? today;
    const toDate = args.date ?? args.to ?? tomorrowStr;
    const dates = getDateRange(fromDate, toDate);
    const season = getCurrentSeason();

    console.log(`\nAPI-Sports Seed (Europe & South America)`);
    console.log(`Continents: Europe, South America`);
    console.log(`Season: ${season}`);
    console.log(`Dates: ${dates.join(", ")}`);
    console.log(`(Override: --date=YYYY-MM-DD or --from=YYYY-MM-DD --to=YYYY-MM-DD)\n`);

    // ==========================================
    // STEP 1: SPORT
    // ==========================================
    console.log("[1/5] Creating Football sport...");
    const sportId = await repo.getOrCreateFootballSport();
    console.log(`  Football sport ID: ${sportId}\n`);

    // ==========================================
    // STEP 2: COUNTRIES (saved to DB)
    // ==========================================
    console.log("[2/5] Fetching and seeding countries from API-Sports...");
    const countriesResult = await apiSports.getCountries();
    const allCountries = countriesResult.response;
    console.log(`  ${allCountries.length} total countries fetched from API`);

    const filteredCountries = allCountries.filter(c => TARGET_COUNTRIES.has(c.name));
    console.log(`  ${filteredCountries.length} countries match target continents`);

    let countryCount = 0;
    for (const c of filteredCountries) {
        try {
            await repo.upsertCountry(c.name, c.code, c.flag);
            countryCount++;
        } catch (err: any) {
            console.error(`  x Country ${c.name}: ${err.message}`);
        }
    }
    console.log(`  Countries seeded: ${countryCount}\n`);

    // ==========================================
    // STEP 3: LEAGUES
    // ==========================================
    console.log("[3/5] Fetching and seeding major leagues...");
    const leagueInternalIds = new Map<number, string>(); // api_id → internal UUID
    let leagueCount = 0;

    // Fetching leagues and strictly filtering to our major competition IDs
    const leaguesResult = await apiSports.getLeagues();
    const targetLeagues = leaguesResult.response.filter(item => 
        MAJOR_LEAGUE_IDS.has(item.league.id)
    );

    console.log(`  ${targetLeagues.length} target leagues filtered (Strict mode: top 2 leagues + major cups only)`);

    // To avoid hitting API limits too fast, we might want to prioritize top tiers
    // For now, let's take all leagues from target countries but we'll be careful in next steps
    for (const leagueData of targetLeagues) {
        try {
            const isMajor = MAJOR_LEAGUE_IDS.has(leagueData.league.id);
            const leagueId = await repo.upsertLeagueFromApi(sportId, leagueData, isMajor);
            leagueInternalIds.set(leagueData.league.id, leagueId);
            leagueCount++;
            console.log(`  + ${leagueData.league.name} (${leagueData.country.name})${isMajor ? " [MAJOR]" : ""}`);
        } catch (err: any) {
            console.error(`  x League ${leagueData.league.name}: ${err.message}`);
        }
    }
    console.log(`  Leagues seeded: ${leagueCount}\n`);

    // ==========================================
    // STEP 4: TEAMS (fetched directly from /teams per league)
    // ==========================================
    console.log("[4/5] Fetching and seeding teams for each league...");
    let teamCount = 0;
    let apiCallCount = 0;
    const MAX_API_CALLS = 80; // Safety limit for free tier

    // Sort leagues by some criteria if needed, or just process them
    // We'll process only top tier if too many, but let's try all first
    for (const leagueData of targetLeagues) {
        if (apiCallCount >= MAX_API_CALLS) {
            console.warn(`  ! Reached safety API call limit (${MAX_API_CALLS}). Skipping remaining leagues.`);
            break;
        }

        const leagueId = leagueInternalIds.get(leagueData.league.id);
        if (!leagueId) continue;

        try {
            console.log(`  Fetching teams for ${leagueData.league.name} (${leagueData.country.name})...`);
            const result = await apiSports.getTeams({ league: String(leagueData.league.id), season });
            apiCallCount++;
            
            // Limit to top 10 most relevant teams
            let teamsToProcess = result.response;

            // For international competitions, only include teams from our target countries
            const isInternational = [1, 2, 3, 4, 848].includes(leagueData.league.id);
            if (isInternational) {
                teamsToProcess = teamsToProcess.filter(t => TARGET_COUNTRIES.has(t.team.country));
            }

            // Strictly limit to Top 10
            teamsToProcess = teamsToProcess.slice(0, 10);
            console.log(`    Found ${result.results} teams, processing top ${teamsToProcess.length}`);

            for (const teamData of teamsToProcess) {
                try {
                    await repo.upsertTeamFromApi(leagueId, teamData);
                    teamCount++;
                } catch (err: any) {
                    console.error(`    x Team ${teamData.team.name}: ${err.message}`);
                }
            }
        } catch (err: any) {
            console.error(`  x Teams for ${leagueData.league.name}: ${err.message}`);
        }
    }
    console.log(`  Teams seeded: ${teamCount}\n`);

    // ==========================================
    // STEP 5: MATCHES (fixtures by date)
    // ==========================================
    console.log("[5/5] Fetching and seeding matches for the next few days...");
    let matchCount = 0;
    let matchErrors = 0;
    const targetLeagueIdsSet = new Set(targetLeagues.map(l => l.league.id));

    for (const date of dates) {
        if (apiCallCount >= 95) { // Leave room for other operations
            console.warn(`  ! Reached overall safety API call limit. Skipping remaining dates.`);
            break;
        }

        try {
            console.log(`  Fetching fixtures for ${date}...`);
            const result = await apiSports.getFixtures({ date });
            apiCallCount++;
            
            const relevantFixtures = result.response.filter(f => targetLeagueIdsSet.has(f.league.id));
            console.log(`    ${result.results} total fixtures, ${relevantFixtures.length} in target leagues.`);

            for (const fixture of relevantFixtures) {
                const leagueId = leagueInternalIds.get(fixture.league.id);
                
                // For matches, we can upsert teams on the fly if missing, 
                // but the upsertMatchFromApi currently expects internal IDs.
                // repo.upsertMatchFromApi(fixture, leagueInternalId, homeTeamInternalId, awayTeamInternalId)
                
                // Let's use a more robust approach: resolve or create teams
                try {
                    const homeTeamId = await repo.upsertTeamFromApi(leagueId!, {
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

                    const awayTeamId = await repo.upsertTeamFromApi(leagueId!, {
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

                    await repo.upsertMatchFromApi(fixture, leagueId!, homeTeamId, awayTeamId);
                    matchCount++;
                } catch (err: any) {
                    matchErrors++;
                    console.error(`    x Fixture ${fixture.fixture.id}: ${err.message}`);
                }
            }
        } catch (err: any) {
            console.error(`  x ${date}: ${err.message}`);
        }
    }
    console.log(`  Matches seeded: ${matchCount}, Errors: ${matchErrors}\n`);

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log("========================================");
    console.log("Seed completed (Europe & South America)");
    console.log(`  Sport:     1 (Football)`);
    console.log(`  Countries: ${countryCount}`);
    console.log(`  Leagues:   ${leagueCount}`);
    console.log(`  Teams:     ${teamCount} (estimated)`);
    console.log(`  Matches:   ${matchCount}`);
    console.log(`  API Calls: ${apiCallCount}`);
    console.log("========================================\n");
}

seed()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Seed failed:", err);
        process.exit(1);
    });
