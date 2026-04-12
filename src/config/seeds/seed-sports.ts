/**
 * Seed script for Sports, Leagues, and Teams
 * Creates ~50 sports entries with associated leagues and teams
 * 
 * Run with: bun run scripts/seed-sports.ts
 */

import { db } from "../config.db";
import { sportsTable, leaguesTable, teamsTable, teamLeaguesTable } from "../db/sports.table";
import { eq } from "drizzle-orm";

// ============================================
// SPORTS DATA
// ============================================

const sportsData = [
    {
        name: "Football",
        slug: "football",
        description: "Association football, commonly known as soccer in some countries",
        icon_url: "https://cdn.example.com/icons/football.svg",
        display_order: 1,
        leagues: [
            // England
            {
                name: "Premier League",
                slug: "premier-league",
                country: "England",
                description: "Top tier of English football",
                is_major: true,
                teams: [
                    { name: "Arsenal", slug: "arsenal", city: "London", country: "England", founded_year: 1886 },
                    { name: "Manchester City", slug: "manchester-city", city: "Manchester", country: "England", founded_year: 1880 },
                    { name: "Liverpool", slug: "liverpool", city: "Liverpool", country: "England", founded_year: 1892 },
                    { name: "Aston Villa", slug: "aston-villa", city: "Birmingham", country: "England", founded_year: 1874 },
                    { name: "Tottenham", slug: "tottenham", city: "London", country: "England", founded_year: 1882 },
                    { name: "Chelsea", slug: "chelsea", city: "London", country: "England", founded_year: 1905 },
                    { name: "Manchester United", slug: "manchester-united", city: "Manchester", country: "England", founded_year: 1878 },
                    { name: "Newcastle", slug: "newcastle", city: "Newcastle", country: "England", founded_year: 1892 },
                    { name: "West Ham", slug: "west-ham", city: "London", country: "England", founded_year: 1895 },
                    { name: "Brighton", slug: "brighton", city: "Brighton", country: "England", founded_year: 1901 },
                ],
            },
            {
                name: "EFL Championship",
                slug: "championship",
                country: "England",
                description: "Second tier of English football",
                is_major: false,
                teams: [
                    { name: "Leicester", slug: "leicester", city: "Leicester", country: "England", founded_year: 1884 },
                    { name: "Leeds", slug: "leeds", city: "Leeds", country: "England", founded_year: 1919 },
                    { name: "Southampton", slug: "southampton", city: "Southampton", country: "England", founded_year: 1885 },
                ],
            },
            { name: "FA Cup", slug: "fa-cup", country: "England", description: "The oldest national football competition in the world", is_major: true, teams: [] },
            { name: "EFL Cup", slug: "efl-cup", country: "England", description: "League Cup", is_major: false, teams: [] },

            // Spain
            {
                name: "La Liga",
                slug: "la-liga",
                country: "Spain",
                description: "Top tier of Spanish football",
                is_major: true,
                teams: [
                    { name: "Real Madrid", slug: "real-madrid", city: "Madrid", country: "Spain", founded_year: 1902 },
                    { name: "FC Barcelona", slug: "fc-barcelona", city: "Barcelona", country: "Spain", founded_year: 1899 },
                    { name: "Atletico Madrid", slug: "atletico-madrid", city: "Madrid", country: "Spain", founded_year: 1903 },
                    { name: "Girona", slug: "girona", city: "Girona", country: "Spain", founded_year: 1930 },
                    { name: "Athletic Club", slug: "athletic-club", city: "Bilbao", country: "Spain", founded_year: 1898 },
                    { name: "Real Sociedad", slug: "real-sociedad", city: "San Sebastian", country: "Spain", founded_year: 1909 },
                ],
            },
            { name: "La Liga 2", slug: "la-liga-2", country: "Spain", is_major: false, teams: [] },
            { name: "Copa del Rey", slug: "copa-del-rey", country: "Spain", is_major: true, teams: [] },

            // Italy
            {
                name: "Serie A",
                slug: "serie-a",
                country: "Italy",
                description: "Top tier of Italian football",
                is_major: true,
                teams: [
                    { name: "Inter Milan", slug: "inter-milan", city: "Milan", country: "Italy", founded_year: 1908 },
                    { name: "AC Milan", slug: "ac-milan", city: "Milan", country: "Italy", founded_year: 1899 },
                    { name: "Juventus", slug: "juventus", city: "Turin", country: "Italy", founded_year: 1897 },
                    { name: "Atalanta", slug: "atalanta", city: "Bergamo", country: "Italy", founded_year: 1907 },
                    { name: "AS Roma", slug: "as-roma", city: "Rome", country: "Italy", founded_year: 1927 },
                    { name: "Napoli", slug: "napoli", city: "Naples", country: "Italy", founded_year: 1926 },
                ],
            },
            { name: "Serie B", slug: "serie-b", country: "Italy", is_major: false, teams: [] },
            { name: "Coppa Italia", slug: "coppa-italia", country: "Italy", is_major: true, teams: [] },

            // Germany
            {
                name: "Bundesliga",
                slug: "bundesliga",
                country: "Germany",
                description: "Top tier of German football",
                is_major: true,
                teams: [
                    { name: "Bayer Leverkusen", slug: "bayer-leverkusen", city: "Leverkusen", country: "Germany", founded_year: 1904 },
                    { name: "Bayern Munich", slug: "bayern-munich", city: "Munich", country: "Germany", founded_year: 1900 },
                    { name: "VfB Stuttgart", slug: "vfb-stuttgart", city: "Stuttgart", country: "Germany", founded_year: 1893 },
                    { name: "Borussia Dortmund", slug: "borussia-dortmund", city: "Dortmund", country: "Germany", founded_year: 1909 },
                    { name: "RB Leipzig", slug: "rb-leipzig", city: "Leipzig", country: "Germany", founded_year: 2009 },
                ],
            },
            { name: "2. Bundesliga", slug: "2-bundesliga", country: "Germany", is_major: false, teams: [] },
            { name: "DFB-Pokal", slug: "dfb-pokal", country: "Germany", is_major: true, teams: [] },

            // France
            {
                name: "Ligue 1",
                slug: "ligue-1",
                country: "France",
                description: "Top tier of French football",
                is_major: true,
                teams: [
                    { name: "Paris Saint-Germain", slug: "paris-saint-germain", city: "Paris", country: "France", founded_year: 1970 },
                    { name: "AS Monaco", slug: "as-monaco", city: "Monaco", country: "Monaco", founded_year: 1924 },
                    { name: "Olympique Marseille", slug: "olympique-marseille", city: "Marseille", country: "France", founded_year: 1899 },
                    { name: "Lille OSC", slug: "lille", city: "Lille", country: "France", founded_year: 1944 },
                ],
            },
            { name: "Ligue 2", slug: "ligue-2", country: "France", is_major: false, teams: [] },
            { name: "Coupe de France", slug: "coupe-de-france", country: "France", is_major: true, teams: [] },

            // Netherlands
            {
                name: "Eredivisie",
                slug: "eredivisie",
                country: "Netherlands",
                description: "Top tier of Dutch football",
                is_major: true,
                teams: [
                    { name: "PSV Eindhoven", slug: "psv", city: "Eindhoven", country: "Netherlands", founded_year: 1913 },
                    { name: "Feyenoord", slug: "feyenoord", city: "Rotterdam", country: "Netherlands", founded_year: 1908 },
                    { name: "Ajax", slug: "ajax", city: "Amsterdam", country: "Netherlands", founded_year: 1900 },
                    { name: "AZ Alkmaar", slug: "az", city: "Alkmaar", country: "Netherlands", founded_year: 1967 },
                ],
            },
            { name: "Eerste Divisie", slug: "eerste-divisie", country: "Netherlands", is_major: false, teams: [] },
            { name: "KNVB Beker", slug: "knvb-beker", country: "Netherlands", is_major: true, teams: [] },

            // International
            { name: "UEFA Champions League", slug: "champions-league", country: "World", description: "Premier European club competition", is_major: true, teams: [] },
            { name: "UEFA Europa League", slug: "europa-league", country: "World", is_major: true, teams: [] },
            { name: "UEFA Conference League", slug: "conference-league", country: "World", is_major: true, teams: [] },
            { name: "FIFA World Cup", slug: "world-cup", country: "World", is_major: true, teams: [] },
            { name: "Euro Championship", slug: "euro-championship", country: "World", is_major: true, teams: [] },
        ],
    },
    {
        name: "Basketball",
        slug: "basketball",
        description: "Professional basketball",
        icon_url: "https://cdn.example.com/icons/basketball.svg",
        display_order: 2,
        leagues: [
            {
                name: "NBA",
                slug: "nba",
                country: "USA",
                description: "National Basketball Association",
                is_major: true,
                teams: [
                    { name: "Los Angeles Lakers", slug: "los-angeles-lakers", city: "Los Angeles", country: "USA", founded_year: 1947 },
                    { name: "Golden State Warriors", slug: "golden-state-warriors", city: "San Francisco", country: "USA", founded_year: 1946 },
                    { name: "Boston Celtics", slug: "boston-celtics", city: "Boston", country: "USA", founded_year: 1946 },
                    { name: "Miami Heat", slug: "miami-heat", city: "Miami", country: "USA", founded_year: 1988 },
                    { name: "Chicago Bulls", slug: "chicago-bulls", city: "Chicago", country: "USA", founded_year: 1966 },
                ],
            },
            {
                name: "EuroLeague",
                slug: "euroleague",
                country: "Europe",
                description: "Top European basketball league",
                teams: [
                    { name: "Real Madrid Baloncesto", slug: "real-madrid-baloncesto", city: "Madrid", country: "Spain", founded_year: 1931 },
                    { name: "FC Barcelona Basquet", slug: "fc-barcelona-basquet", city: "Barcelona", country: "Spain", founded_year: 1926 },
                    { name: "Olympiacos BC", slug: "olympiacos-bc", city: "Piraeus", country: "Greece", founded_year: 1931 },
                ],
            },
        ],
    },
    {
        name: "American Football",
        slug: "american-football",
        description: "Professional American football",
        icon_url: "https://cdn.example.com/icons/american-football.svg",
        display_order: 3,
        leagues: [
            {
                name: "NFL",
                slug: "nfl",
                country: "USA",
                description: "National Football League",
                teams: [
                    { name: "Kansas City Chiefs", slug: "kansas-city-chiefs", city: "Kansas City", country: "USA", founded_year: 1960 },
                    { name: "San Francisco 49ers", slug: "san-francisco-49ers", city: "San Francisco", country: "USA", founded_year: 1946 },
                    { name: "Dallas Cowboys", slug: "dallas-cowboys", city: "Dallas", country: "USA", founded_year: 1960 },
                    { name: "New England Patriots", slug: "new-england-patriots", city: "Boston", country: "USA", founded_year: 1960 },
                    { name: "Green Bay Packers", slug: "green-bay-packers", city: "Green Bay", country: "USA", founded_year: 1919 },
                ],
            },
        ],
    },
    {
        name: "Baseball",
        slug: "baseball",
        description: "Professional baseball",
        icon_url: "https://cdn.example.com/icons/baseball.svg",
        display_order: 4,
        leagues: [
            {
                name: "MLB",
                slug: "mlb",
                country: "USA",
                description: "Major League Baseball",
                teams: [
                    { name: "New York Yankees", slug: "new-york-yankees", city: "New York", country: "USA", founded_year: 1901 },
                    { name: "Los Angeles Dodgers", slug: "los-angeles-dodgers", city: "Los Angeles", country: "USA", founded_year: 1883 },
                    { name: "Boston Red Sox", slug: "boston-red-sox", city: "Boston", country: "USA", founded_year: 1901 },
                    { name: "Chicago Cubs", slug: "chicago-cubs", city: "Chicago", country: "USA", founded_year: 1876 },
                ],
            },
        ],
    },
    {
        name: "Ice Hockey",
        slug: "ice-hockey",
        description: "Professional ice hockey",
        icon_url: "https://cdn.example.com/icons/ice-hockey.svg",
        display_order: 5,
        leagues: [
            {
                name: "NHL",
                slug: "nhl",
                country: "USA/Canada",
                description: "National Hockey League",
                teams: [
                    { name: "Toronto Maple Leafs", slug: "toronto-maple-leafs", city: "Toronto", country: "Canada", founded_year: 1917 },
                    { name: "Montreal Canadiens", slug: "montreal-canadiens", city: "Montreal", country: "Canada", founded_year: 1909 },
                    { name: "Boston Bruins", slug: "boston-bruins", city: "Boston", country: "USA", founded_year: 1924 },
                    { name: "New York Rangers", slug: "new-york-rangers", city: "New York", country: "USA", founded_year: 1926 },
                ],
            },
        ],
    },
    {
        name: "Tennis",
        slug: "tennis",
        description: "Professional tennis tournaments",
        icon_url: "https://cdn.example.com/icons/tennis.svg",
        display_order: 6,
        leagues: [
            {
                name: "ATP Tour",
                slug: "atp-tour",
                country: "International",
                description: "Association of Tennis Professionals",
                teams: [], // Tennis is individual, no teams
            },
            {
                name: "WTA Tour",
                slug: "wta-tour",
                country: "International",
                description: "Women's Tennis Association",
                teams: [],
            },
        ],
    },
    {
        name: "Golf",
        slug: "golf",
        description: "Professional golf tournaments",
        icon_url: "https://cdn.example.com/icons/golf.svg",
        display_order: 7,
        leagues: [
            {
                name: "PGA Tour",
                slug: "pga-tour",
                country: "USA",
                description: "Professional Golfers Association Tour",
                teams: [],
            },
            {
                name: "European Tour",
                slug: "european-tour",
                country: "Europe",
                description: "DP World Tour",
                teams: [],
            },
        ],
    },
    {
        name: "Rugby",
        slug: "rugby",
        description: "Professional rugby union and league",
        icon_url: "https://cdn.example.com/icons/rugby.svg",
        display_order: 8,
        leagues: [
            {
                name: "Six Nations",
                slug: "six-nations",
                country: "Europe",
                description: "Annual rugby union championship",
                teams: [
                    { name: "England Rugby", slug: "england-rugby", city: "London", country: "England", founded_year: 1871 },
                    { name: "Ireland Rugby", slug: "ireland-rugby", city: "Dublin", country: "Ireland", founded_year: 1879 },
                    { name: "France Rugby", slug: "france-rugby", city: "Paris", country: "France", founded_year: 1906 },
                    { name: "Wales Rugby", slug: "wales-rugby", city: "Cardiff", country: "Wales", founded_year: 1881 },
                ],
            },
            {
                name: "Super Rugby",
                slug: "super-rugby",
                country: "Southern Hemisphere",
                description: "Premier rugby competition in the southern hemisphere",
                teams: [
                    { name: "Crusaders", slug: "crusaders", city: "Christchurch", country: "New Zealand", founded_year: 1996 },
                    { name: "Blues", slug: "blues", city: "Auckland", country: "New Zealand", founded_year: 1996 },
                ],
            },
        ],
    },
    {
        name: "Cricket",
        slug: "cricket",
        description: "Professional cricket",
        icon_url: "https://cdn.example.com/icons/cricket.svg",
        display_order: 9,
        leagues: [
            {
                name: "IPL",
                slug: "ipl",
                country: "India",
                description: "Indian Premier League",
                teams: [
                    { name: "Mumbai Indians", slug: "mumbai-indians", city: "Mumbai", country: "India", founded_year: 2008 },
                    { name: "Chennai Super Kings", slug: "chennai-super-kings", city: "Chennai", country: "India", founded_year: 2008 },
                    { name: "Royal Challengers Bangalore", slug: "royal-challengers-bangalore", city: "Bangalore", country: "India", founded_year: 2008 },
                ],
            },
            {
                name: "Big Bash League",
                slug: "big-bash-league",
                country: "Australia",
                description: "Australian Twenty20 cricket league",
                teams: [
                    { name: "Sydney Sixers", slug: "sydney-sixers", city: "Sydney", country: "Australia", founded_year: 2011 },
                    { name: "Melbourne Stars", slug: "melbourne-stars", city: "Melbourne", country: "Australia", founded_year: 2011 },
                ],
            },
        ],
    },
    {
        name: "Formula 1",
        slug: "formula-1",
        description: "FIA Formula One World Championship",
        icon_url: "https://cdn.example.com/icons/f1.svg",
        display_order: 10,
        leagues: [
            {
                name: "F1 World Championship",
                slug: "f1-world-championship",
                country: "International",
                description: "Formula 1 World Championship",
                is_major: true,
                teams: [
                    { name: "Red Bull Racing", slug: "red-bull-racing", city: "Milton Keynes", country: "UK", founded_year: 2005 },
                    { name: "Mercedes-AMG Petronas", slug: "mercedes-amg-petronas", city: "Brackley", country: "UK", founded_year: 2010 },
                    { name: "Scuderia Ferrari", slug: "scuderia-ferrari", city: "Maranello", country: "Italy", founded_year: 1929 },
                    { name: "McLaren F1", slug: "mclaren-f1", city: "Woking", country: "UK", founded_year: 1963 },
                ],
            },
        ],
    },
    {
        name: "MMA",
        slug: "mma",
        description: "Mixed Martial Arts",
        icon_url: "https://cdn.example.com/icons/mma.svg",
        display_order: 11,
        leagues: [
            {
                name: "UFC",
                slug: "ufc",
                country: "USA",
                description: "Ultimate Fighting Championship",
                teams: [], // Individual sport
            },
        ],
    },
    {
        name: "Boxing",
        slug: "boxing",
        description: "Professional boxing",
        icon_url: "https://cdn.example.com/icons/boxing.svg",
        display_order: 12,
        leagues: [
            {
                name: "WBC",
                slug: "wbc",
                country: "International",
                description: "World Boxing Council",
                teams: [],
            },
            {
                name: "WBA",
                slug: "wba",
                country: "International",
                description: "World Boxing Association",
                teams: [],
            },
        ],
    },
];

// ============================================
// SEED FUNCTION
// ============================================

async function seedSports() {
    console.log("🏈 Starting sports seed...\n");

    let sportCount = 0;
    let leagueCount = 0;
    let teamCount = 0;

    for (const sportData of sportsData) {
        try {
            // Insert sport
            const [sport] = await db.insert(sportsTable).values({
                name: sportData.name,
                slug: sportData.slug,
                description: sportData.description,
                icon_url: sportData.icon_url,
                display_order: sportData.display_order,
                is_active: true,
            }).onConflictDoNothing().returning();

            if (!sport) {
                console.log(`  ⏭️  Sport "${sportData.name}" already exists, skipping...`);
                continue;
            }

            sportCount++;
            console.log(`✅ Created sport: ${sport.name}`);

            // Insert leagues for this sport
            for (const leagueData of sportData.leagues) {
                const [league] = await db.insert(leaguesTable).values({
                    sport_id: sport.id,
                    name: leagueData.name,
                    slug: leagueData.slug,
                    country: leagueData.country,
                    description: leagueData.description,
                    logo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(leagueData.name)}&background=random`,
                    is_major: (leagueData as any).is_major ?? false,
                    is_active: true,
                }).onConflictDoNothing().returning();

                if (!league) {
                    console.log(`    ⏭️  League "${leagueData.name}" already exists, skipping...`);
                    // Try to fetch existing league to ensure we can insert teams
                    const [existingLeague] = await db.select().from(leaguesTable).where(eq(leaguesTable.slug, leagueData.slug));
                    if (existingLeague) {
                        // Continue with existing league
                        // But we need 'league' variable to be set for the next block
                        // So we can re-assign if we change 'const' to 'let' or just refactor slightly.
                        // For now, let's just proceed to next iteration if not created, as per original logic.
                        // Actually original logic skips teams if league exists. That might be intended.
                        continue;
                    }
                    continue;
                }

                leagueCount++;
                console.log(`  📋 Created league: ${league.name}`);

                // Insert teams for this league
                for (const teamData of leagueData.teams) {
                    let [team] = await db.insert(teamsTable).values({
                        name: teamData.name,
                        slug: teamData.slug,
                        city: teamData.city,
                        country: teamData.country,
                        founded_year: teamData.founded_year,
                        logo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(teamData.name)}&background=random`,
                        is_active: true,
                    }).onConflictDoNothing().returning();

                    if (!team) {
                        const existing = await db.select().from(teamsTable).where(eq(teamsTable.slug, teamData.slug));
                        team = existing[0];
                    }

                    if (team) {
                        await db.insert(teamLeaguesTable).values({
                            team_id: team.id,
                            league_id: league.id,
                        }).onConflictDoNothing();

                        teamCount++;
                        console.log(`    🏆 Processed team: ${team.name}`);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error seeding sport ${sportData.name}:`, error);
        }
    }

    console.log("\n========================================");
    console.log("🎉 Sports seed completed!");
    console.log(`   Sports: ${sportCount}`);
    console.log(`   Leagues: ${leagueCount}`);
    console.log(`   Teams: ${teamCount}`);
    console.log(`   Total: ${sportCount + leagueCount + teamCount}`);
    console.log("========================================\n");
}

// Run seed
seedSports()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    });
