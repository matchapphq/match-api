import { db } from "../../config/config.db";
import { matchesTable, venueMatchesTable } from "../../config/db/matches.table";
import { eq, and, gte, desc, asc } from "drizzle-orm";
import { SportsRepository } from "../../repository/sports.repository";
import { apiSports, mapFixtureStatus } from "../../lib/api-sports";
import type { ApiFixtureResponse } from "../../lib/api-sports";

export class MatchesLogic {
    private sportsRepo = new SportsRepository();

    /**
     * Try to sync today's fixtures from API-Sports into the DB.
     * Non-blocking — errors are caught and logged.
     */
    private async trySyncTodayFixtures(): Promise<void> {
        try {
            if (!process.env.API_SPORTS_KEY) return;

            const today = new Date().toISOString().split("T")[0];
            const apiResult = await apiSports.getFixtures({ date: today });

            for (const fixture of apiResult.response) {
                try {
                    await this.syncSingleFixture(fixture);
                } catch (err) {
                    // Log but don't fail
                    console.error(`[SYNC] Fixture ${fixture.fixture.id} sync error:`, err);
                }
            }
        } catch (err) {
            console.error("[SYNC] Failed to sync today's fixtures:", err);
        }
    }

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

    async getMatches(status?: string, limit: number = 20, offset: number = 0) {
        // Try to sync fresh data from API-Sports (non-blocking)
        this.trySyncTodayFixtures().catch(() => {});

        return await db.query.matchesTable.findMany({
            where: status 
                ? eq(matchesTable.status, status as any)
                : gte(matchesTable.scheduled_at, new Date()),
            with: {
                homeTeam: true,
                awayTeam: true,
                league: true,
            },
            orderBy: [asc(matchesTable.scheduled_at)],
            limit,
            offset,
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

    async getUpcoming(limit: number = 20, offset: number = 0) {
        // Try to sync fresh data from API-Sports (non-blocking)
        this.trySyncTodayFixtures().catch(() => {});

        return await db.query.matchesTable.findMany({
            where: gte(matchesTable.scheduled_at, new Date()),
            with: {
                homeTeam: true,
                awayTeam: true,
                league: true,
            },
            orderBy: [asc(matchesTable.scheduled_at)],
            limit,
            offset,
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
