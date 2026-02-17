import { db } from "../../config/config.db";
import { matchesTable, venueMatchesTable } from "../../config/db/matches.table";
import { eq, and, gte, desc, asc, sql, isNotNull } from "drizzle-orm";
import { SportsRepository } from "../../repository/sports.repository";
import { apiSports, mapFixtureStatus } from "../../lib/api-sports";
import type { ApiFixtureResponse } from "../../lib/api-sports";
import { teamsTable } from "../../config/db/sports.table";

// ============================================
// Popular leagues to auto-sync (API-Sports IDs)
// Add more as needed — each costs 1 API call
// ============================================
const DEFAULT_SYNC_LEAGUES = [
    39,   // Premier League (England)
    140,  // La Liga (Spain)
    135,  // Serie A (Italy)
    78,   // Bundesliga (Germany)
    61,   // Ligue 1 (France)
    94,   // Primeira Liga (Portugal)
    2,    // Champions League
    3,    // Europa League
    848,  // Conference League
    253,  // MLS (USA)
];

// How many upcoming real fixtures we need before skipping auto-sync
const MIN_UPCOMING_THRESHOLD = 5;

export class MatchesLogic {
    private sportsRepo = new SportsRepository();
    private syncInProgress = false;

    // ============================================
    // SYNC LOGIC
    // ============================================

    /**
     * Sync a single fixture into the DB — creates league/team/match as needed.
     */
    private async syncSingleFixture(fixture: ApiFixtureResponse): Promise<string | null> {
        const sportId = await this.sportsRepo.getOrCreateFootballSport();

        const leagueInternalId = await this.sportsRepo.upsertLeagueFromApi(sportId, {
            league: {
                id: fixture.league.id,
                name: fixture.league.name,
                type: "League",
                logo: fixture.league.logo,
            },
            country: {
                name: fixture.league.country,
                code: null,
                flag: fixture.league.flag,
            },
            seasons: [],
        });

        const homeTeamId = await this.sportsRepo.upsertTeamFromApi(leagueInternalId, {
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

        const awayTeamId = await this.sportsRepo.upsertTeamFromApi(leagueInternalId, {
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

        return await this.sportsRepo.upsertMatchFromApi(
            fixture,
            leagueInternalId,
            homeTeamId,
            awayTeamId,
        );
    }

    /**
     * Count upcoming real matches (ones with external_id, i.e. from API-Sports).
     */
    private async countUpcomingRealMatches(): Promise<number> {
        const [result] = await db.select({ count: sql<number>`count(*)::int` })
            .from(matchesTable)
            .where(and(
                gte(matchesTable.scheduled_at, new Date()),
                isNotNull(matchesTable.external_id),
            ));
        return result?.count ?? 0;
    }

    /**
     * Count all real matches in DB (with external_id).
     */
    private async countRealMatches(): Promise<number> {
        const [result] = await db.select({ count: sql<number>`count(*)::int` })
            .from(matchesTable)
            .where(isNotNull(matchesTable.external_id));
        return result?.count ?? 0;
    }

    /**
     * Get the current football season year.
     * Football seasons span Aug–May. If month >= August, season = year; else season = year - 1.
     * e.g. Feb 2026 → season "2025" (2025-2026 season)
     */
    private getCurrentSeason(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed: 0=Jan, 7=Aug
        return month >= 7 ? String(year) : String(year - 1);
    }

    /**
     * Ensure we have enough upcoming real fixtures in the DB.
     * If not, do a BLOCKING sync from API-Sports for popular leagues.
     * Uses a lock to prevent concurrent syncs.
     */
    private async ensureUpcomingFixtures(): Promise<void> {
        if (!process.env.API_SPORTS_KEY) return;
        if (this.syncInProgress) return;

        const upcomingCount = await this.countUpcomingRealMatches();
        if (upcomingCount >= MIN_UPCOMING_THRESHOLD) return;

        console.log(`[SYNC] Only ${upcomingCount} upcoming real fixtures in DB (threshold: ${MIN_UPCOMING_THRESHOLD}). Syncing...`);
        // We trigger the sync in the background without awaiting it to avoid timeouts in the mobile app
        this.syncFixturesForLeagues(DEFAULT_SYNC_LEAGUES).catch(err => {
            console.error("[SYNC] Background sync failed:", err);
        });
    }

    /**
     * Public: Bulk-sync fixtures for given leagues.
     * Uses date range (from/to) with league + season.
     * Defaults to fetching the next 14 days of fixtures per league.
     */
    async syncFixturesForLeagues(
        leagueApiIds: number[] = DEFAULT_SYNC_LEAGUES,
        options: { season?: string; from?: string; to?: string; days?: number } = {}
    ): Promise<{ synced: number; errors: number; leagues: number }> {
        if (this.syncInProgress) {
            return { synced: 0, errors: 0, leagues: 0 };
        }

        this.syncInProgress = true;
        let totalSynced = 0;
        let totalErrors = 0;
        let leaguesProcessed = 0;

        try {
            const season = options.season ?? this.getCurrentSeason();

            // Default date range: from today to +14 days
            const now = new Date();
            const fromDate = options.from ?? now.toISOString().split("T")[0]!;
            const futureDate = new Date(now);
            futureDate.setDate(futureDate.getDate() + (options.days ?? 14));
            const toDate = options.to ?? futureDate.toISOString().split("T")[0]!;

            console.log(`[SYNC] Syncing fixtures: season=${season}, from=${fromDate}, to=${toDate}, leagues=${leagueApiIds.length}`);

            for (const leagueApiId of leagueApiIds) {
                try {
                    const params: Record<string, string> = {
                        league: String(leagueApiId),
                        season,
                        from: fromDate,
                        to: toDate,
                    };

                    console.log(`[SYNC] Fetching fixtures for league ${leagueApiId}...`);
                    const apiResult = await apiSports.getFixtures(params);

                    for (const fixture of apiResult.response) {
                        try {
                            await this.syncSingleFixture(fixture);
                            totalSynced++;
                        } catch (err) {
                            totalErrors++;
                            console.error(`[SYNC] Fixture ${fixture.fixture.id} error:`, err);
                        }
                    }

                    leaguesProcessed++;
                    console.log(`[SYNC] League ${leagueApiId}: ${apiResult.results} fixtures fetched`);
                } catch (err) {
                    console.error(`[SYNC] League ${leagueApiId} fetch failed:`, err);
                }
            }

            console.log(`[SYNC] Done. Synced: ${totalSynced}, Errors: ${totalErrors}, Leagues: ${leaguesProcessed}`);
        } finally {
            this.syncInProgress = false;
        }

        return { synced: totalSynced, errors: totalErrors, leagues: leaguesProcessed };
    }

    /**
     * Public: Sync today's fixtures (for live score updates).
     */
    async syncTodayFixtures(): Promise<{ synced: number; errors: number }> {
        if (!process.env.API_SPORTS_KEY) {
            return { synced: 0, errors: 0 };
        }

        let synced = 0;
        let errors = 0;

        try {
            const today = new Date().toISOString().split("T")[0];
            const apiResult = await apiSports.getFixtures({ date: today });

            for (const fixture of apiResult.response) {
                try {
                    await this.syncSingleFixture(fixture);
                    synced++;
                } catch (err) {
                    errors++;
                    console.error(`[SYNC] Fixture ${fixture.fixture.id} sync error:`, err);
                }
            }
        } catch (err) {
            console.error("[SYNC] Failed to sync today's fixtures:", err);
        }

        return { synced, errors };
    }

    // ============================================
    // MATCH ENDPOINTS
    // ============================================

    async getMatches(status?: string, limit: number = 20, offset: number = 0, date?: string, sportId?: string) {
        // Blocking sync: ensure we have upcoming real fixtures in DB
        await this.ensureUpcomingFixtures();

        const conditions = [];

        if (status) {
            conditions.push(eq(matchesTable.status, status as any));
        } else {
            // Default to upcoming if no status or date provided
            if (!date) {
                conditions.push(gte(matchesTable.scheduled_at, new Date()));
            }
        }

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            conditions.push(and(
                gte(matchesTable.scheduled_at, startOfDay),
                sql`${matchesTable.scheduled_at} <= ${endOfDay}`
            ));
        }

        if (sportId) {
            // Join with leagues to filter by sport_id
            const matches = await db.select({
                match: matchesTable,
                homeTeam: teamsTable, // This won't work directly with db.query style but we are in logic
            }).from(matchesTable)
            // ... actually db.query is easier for 'with' relations
        }

        return await db.query.matchesTable.findMany({
            where: and(...conditions),
            with: { 
                homeTeam: true, 
                awayTeam: true, 
                league: {
                    with: {
                        sport: true
                    }
                }
            },
            orderBy: [asc(matchesTable.scheduled_at)],
            limit,
            offset,
        }).then(matches => {
            if (sportId) {
                return matches.filter(m => m.league?.sport_id === sportId);
            }
            return matches;
        });
    }

    async getMatchDetails(matchId: string) {
        const match = await db.query.matchesTable.findFirst({
            where: eq(matchesTable.id, matchId),
            with: {
                homeTeam: true,
                awayTeam: true,
                league: true,
            },
        });

        if (!match) {
            throw new Error("MATCH_NOT_FOUND");
        }

        return match;
    }

    async getMatchVenues(matchId: string, lat?: number, lng?: number, maxDistanceKm: number = 50) {
        // Get venue matches with venue details
        const venueMatches = await db.query.venueMatchesTable.findMany({
            where: and(
                eq(venueMatchesTable.match_id, matchId),
                eq(venueMatchesTable.is_active, true),
                eq(venueMatchesTable.allows_reservations, true)
            ),
            with: {
                venue: {
                    columns: {
                        id: true,
                        name: true,
                        city: true,
                        street_address: true,
                        phone: true,
                        latitude: true,
                        longitude: true,
                        average_rating: true,
                        cover_image_url: true,
                    }
                },
            },
        });

        // Transform to include availability info and calculate distance
        let venues = venueMatches.map((vm: any) => {
            let distance: number | null = null;
            
            // Calculate distance if user location provided and venue has coordinates
            if (lat !== undefined && lng !== undefined && vm.venue?.latitude && vm.venue?.longitude) {
                distance = this.calculateDistance(
                    lat,
                    lng,
                    vm.venue.latitude,
                    vm.venue.longitude
                );
            }
            
            return {
                venueMatchId: vm.id,
                venue: {
                    ...vm.venue,
                    rating: vm.venue?.average_rating ? parseFloat(vm.venue.average_rating) : null,
                    image_url: vm.venue?.cover_image_url,
                    distance: distance !== null ? parseFloat(distance.toFixed(2)) : null,
                },
                totalCapacity: vm.total_capacity,
                availableCapacity: vm.available_capacity,
                maxGroupSize: vm.max_group_size,
                isFeatured: vm.is_featured,
                allowsReservations: vm.allows_reservations,
            };
        });

        // Filter by max distance if user location provided
        if (lat !== undefined && lng !== undefined) {
            venues = venues.filter(v => 
                v.venue.distance === null || v.venue.distance <= maxDistanceKm
            );
            
            // Sort by distance (closest first)
            venues.sort((a, b) => {
                if (a.venue.distance === null) return 1;
                if (b.venue.distance === null) return -1;
                return a.venue.distance - b.venue.distance;
            });
        }

        return venues;
    }

    async getUpcoming(limit: number = 20, offset: number = 0, sportId?: string, date?: string, search?: string) {
        // Blocking sync: ensure we have upcoming real fixtures in DB
        await this.ensureUpcomingFixtures();

        const conditions = [gte(matchesTable.scheduled_at, new Date())];

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            conditions.push(and(
                gte(matchesTable.scheduled_at, startOfDay),
                sql`${matchesTable.scheduled_at} <= ${endOfDay}`
            ));
        }

        if (search) {
            // We'll filter in memory after fetching because complex join filtering is harder with db.query
            // but we can try to filter by team names if we join them.
        }

        return await db.query.matchesTable.findMany({
            where: and(...conditions),
            with: { 
                homeTeam: true, 
                awayTeam: true, 
                league: {
                    with: {
                        sport: true
                    }
                } 
            },
            orderBy: [asc(matchesTable.scheduled_at)],
            limit,
            offset,
        }).then(matches => {
            let filtered = matches;
            
            if (sportId) {
                filtered = filtered.filter(m => m.league?.sport_id === sportId);
            }

            if (search) {
                const s = search.toLowerCase();
                filtered = filtered.filter(m => 
                    m.homeTeam?.name?.toLowerCase().includes(s) || 
                    m.awayTeam?.name?.toLowerCase().includes(s) ||
                    m.league?.name?.toLowerCase().includes(s)
                );
            }

            // Map scheduled_at to start_time for frontend compatibility
            return filtered.map(m => ({
                ...m,
                start_time: m.scheduled_at,
                home_team: m.homeTeam,
                away_team: m.awayTeam,
                competition: m.league,
                sport: m.league?.sport,
            }));
        });
    }

    async getUpcomingNearby(lat: number, lng: number, distanceKm: number = 10, limit: number = 20) {
        // Get upcoming venue matches
        const venueMatches = await db.query.venueMatchesTable.findMany({
            where: and(
                eq(venueMatchesTable.is_active, true),
                eq(venueMatchesTable.allows_reservations, true)
            ),
            with: {
                venue: {
                    columns: {
                        id: true,
                        name: true,
                        city: true,
                        latitude: true,
                        longitude: true,
                    }
                },
                match: {
                    with: {
                        homeTeam: true,
                        awayTeam: true,
                        league: true,
                    }
                },
            },
            limit,
        });

        // Filter to only upcoming matches and transform
        const now = new Date();
        const upcoming = venueMatches
            .filter(vm => vm.match && new Date(vm.match.scheduled_at) > now)
            .map(vm => ({
                venueMatchId: vm.id,
                match: vm.match,
                venue: {
                    id: vm.venue?.id,
                    name: vm.venue?.name,
                    city: vm.venue?.city,
                },
                availableCapacity: vm.available_capacity,
                isFeatured: vm.is_featured,
            }))
            .sort((a, b) => 
                new Date(a.match!.scheduled_at).getTime() - new Date(b.match!.scheduled_at).getTime()
            );

        return upcoming;
    }

    async getLiveUpdates(matchId: string) {
        // Try to get real live data from API-Sports
        try {
            if (!process.env.API_SPORTS_KEY) {
                return { message: "API_SPORTS_KEY not configured", matchId };
            }

            // Find the match's external_id
            const match = await db.query.matchesTable.findFirst({
                where: eq(matchesTable.id, matchId),
            });

            if (!match?.external_id) {
                return { message: "No external fixture linked to this match", matchId };
            }

            // Fetch live data for this specific fixture
            const apiResult = await apiSports.getFixtures({ id: match.external_id });
            
            if (apiResult.response.length > 0) {
                const fixture = apiResult.response[0]!;
                // Sync updated data to DB
                await this.syncSingleFixture(fixture);

                return {
                    matchId,
                    fixtureId: fixture.fixture.id,
                    status: fixture.fixture.status,
                    goals: fixture.goals,
                    score: fixture.score,
                    elapsed: fixture.fixture.status.elapsed,
                    teams: fixture.teams,
                    league: {
                        name: fixture.league.name,
                        round: fixture.league.round,
                    },
                };
            }

            return { message: "No live data available", matchId };
        } catch (err) {
            console.error("[LIVE] Failed to fetch live updates:", err);
            return { message: "Failed to fetch live updates", matchId };
        }
    }

    // Haversine formula to calculate distance between two points in km
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of Earth in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}
