import { db } from "../../config/config.db";
import { venuesTable } from "../../config/db/venues.table";
import { matchesTable, venueMatchesTable } from "../../config/db/matches.table";
import { teamsTable, userPreferencesTable, openingHoursExceptionsTable } from "../../config/db/schema";
import { eq, and, gte, lte, ilike, or, isNull, asc, desc, sql, inArray } from "drizzle-orm";

import { DiscoveryRepository } from "../../repository/discovery.repository";
import { MatchesLogic } from "../matches/matches.logic";

export class DiscoveryLogic {
    constructor(
        private readonly discoveryRepository: DiscoveryRepository = new DiscoveryRepository(),
        private readonly matchesLogic: MatchesLogic = new MatchesLogic(),
    ) {}

    async search(params: any) {
        const {
            q = "",
            type = "all",
            page = "1",
            limit = "15",
            lat,
            lng,
            radius_km = "500000",
            date,
        } = params;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;
        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;
        const radiusKm = parseFloat(radius_km);
        const searchQuery = q.trim().toLowerCase();

        let venues: any[] = [];
        let matches: any[] = [];
        let totalVenues = 0;
        let totalMatches = 0;

        if (type === "all" || type === "venues") {
            const venueConditions = [
                isNull(venuesTable.deleted_at),
                eq(venuesTable.is_active, true),
            ];

            if (searchQuery) {
                venueConditions.push(or(
                    ilike(venuesTable.name, `%${searchQuery}%`),
                    ilike(venuesTable.city, `%${searchQuery}%`),
                    ilike(venuesTable.type, `%${searchQuery}%`),
                )!);
            }

            if (userLat && userLng) {
                const distanceMeters = radiusKm * 1000;
                venueConditions.push(sql`ST_DWithin(
                    ${venuesTable.location}::geography, 
                    ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography, 
                    ${distanceMeters}
                )`);
            }

            const venueWhere = and(...venueConditions);

            const [venueCount] = await db.select({ count: sql<number>`count(*)` })
                .from(venuesTable)
                .where(venueWhere);
            totalVenues = Number(venueCount?.count ?? 0);

            let orderBy: any = desc(venuesTable.created_at);
            if (userLat && userLng) {
                orderBy = sql`ST_Distance(
                    ${venuesTable.location}::geography, 
                    ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography
                )`;
            }

            venues = await db.query.venuesTable.findMany({
                where: venueWhere,
                limit: limitNum,
                offset: offset,
                orderBy: orderBy,
                with: { photos: true },
            });

            if (userLat && userLng) {
                venues = venues.map(v => ({
                    ...v,
                    distance: v.latitude && v.longitude
                        ? this.calculateDistance(userLat, userLng, v.latitude, v.longitude)
                        : null,
                }));
            }
        }

        if (type === "all" || type === "matches") {
            if (!searchQuery) {
                // Optimized path: Count and paginate in SQL
                const conditions = [];
                if (date) {
                    const start = new Date(`${date}T00:00:00Z`);
                    const end = new Date(`${date}T23:59:59.999Z`);
                    conditions.push(gte(matchesTable.scheduled_at, start));
                    conditions.push(lte(matchesTable.scheduled_at, end));
                } else {
                    conditions.push(gte(matchesTable.scheduled_at, new Date()));
                }
                const matchWhere = and(...conditions);

                const [countRes] = await db.select({ count: sql<number>`count(*)` })
                    .from(matchesTable)
                    .where(matchWhere);
                totalMatches = Number(countRes?.count ?? 0);

                matches = await db.query.matchesTable.findMany({
                    where: matchWhere,
                    with: {
                        homeTeam: true,
                        awayTeam: true,
                        league: true,
                    },
                    orderBy: [asc(matchesTable.scheduled_at)],
                    limit: limitNum,
                    offset: offset,
                });
            } else {
                // Search path: Fetch all and filter in memory (until SQL search is implemented)
                let allMatches = await db.query.matchesTable.findMany({
                    where: (matches, { and, gte, lte }) => {
                        const conditions = [];
                        if (date) {
                            const start = new Date(`${date}T00:00:00Z`);
                            const end = new Date(`${date}T23:59:59.999Z`);
                            conditions.push(gte(matches.scheduled_at, start));
                            conditions.push(lte(matches.scheduled_at, end));
                        } else {
                            conditions.push(gte(matches.scheduled_at, new Date()));
                        }
                        return and(...conditions);
                    },
                    with: {
                        homeTeam: true,
                        awayTeam: true,
                        league: true,
                    },
                    orderBy: [asc(matchesTable.scheduled_at)],
                });

                allMatches = allMatches.filter(m => {
                    const homeName = (m.homeTeam?.name || "").toLowerCase();
                    const awayName = (m.awayTeam?.name || "").toLowerCase();
                    const leagueName = (m.league?.name || "").toLowerCase();
                    return homeName.includes(searchQuery) ||
                           awayName.includes(searchQuery) ||
                           leagueName.includes(searchQuery);
                });

                totalMatches = allMatches.length;
                matches = allMatches.slice(offset, offset + limitNum);
            }
        }

        return {
            venues,
            matches,
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalVenues,
                totalMatches,
                hasMoreVenues: offset + venues.length < totalVenues,
                hasMoreMatches: offset + matches.length < totalMatches,
            },
        };
    }

    async getNearby(lat: number, lng: number, radiusKm: number = 10) {
        const distanceMeters = radiusKm * 1000;
        
        const venueConditions = [
            isNull(venuesTable.deleted_at),
            eq(venuesTable.is_active, true),
            sql`ST_DWithin(
                ${venuesTable.location}::geography, 
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 
                ${distanceMeters}
            )`,
        ];

        const venues = await db.query.venuesTable.findMany({
            where: and(...venueConditions),
            orderBy: sql`ST_Distance(
                ${venuesTable.location}::geography, 
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
            )`,
            with: {
                photos: {
                    where: eq(sql`is_primary`, true),
                    limit: 1,
                },
            },
        });

        return venues.map(v => ({
            ...v,
            distance: v.latitude && v.longitude
                ? this.calculateDistance(lat, lng, v.latitude, v.longitude)
                : null,
        }));
    }

    async getVenueDetails(venueId: string, userId?: string) {
        const venue = await db.query.venuesTable.findFirst({
            where: and(
                eq(venuesTable.id, venueId),
                isNull(venuesTable.deleted_at),
            ),
            with: {
                photos: true,
            },
        });

        if (!venue) {
            throw new Error("VENUE_NOT_FOUND");
        }

        // Record view in history if userId provided
        if (userId) {
            await this.discoveryRepository.recordVenueView(userId, venueId);
        }

        // Fetch matches for this venue
        const venueMatches = await db.query.venueMatchesTable.findMany({
            where: and(
                eq(venueMatchesTable.venue_id, venueId),
                eq(venueMatchesTable.is_active, true),
            ),
            with: {
                match: {
                    with: {
                        homeTeam: true,
                        awayTeam: true,
                        league: true,
                    },
                },
            },
            orderBy: (vm, { asc }) => [asc(sql`created_at`)], // Using sql because match.scheduled_at is nested
        });

        return {
            ...venue,
            matches: venueMatches.map(vm => ({
                ...vm.match,
                venueMatchId: vm.id,
                availableCapacity: vm.available_capacity,
                totalCapacity: vm.total_capacity,
            })),
        };
    }

    async getVenueHistory(userId: string, limit: number = 10) {
        return await this.discoveryRepository.getVenueHistory(userId, limit);
    }

    async clearVenueHistory(userId: string) {
        return await this.discoveryRepository.clearVenueHistory(userId);
    }

    /**
     * Get details for teams followed by the user, including live status.
     */
    async getFollowedTeams(userId: string) {
        const prefs = await db.query.userPreferencesTable.findFirst({
            where: eq(userPreferencesTable.user_id, userId),
            columns: {
                fav_team_ids: true,
            }
        });

        const teamIds = prefs?.fav_team_ids || [];
        if (teamIds.length === 0) return [];

        // Fetch team details
        const teams = await db.query.teamsTable.findMany({
            where: inArray(teamsTable.id, teamIds),
        });

        // Check for live matches for these teams
        const liveMatches = await this.matchesLogic.getMatches('live');
        
        return teams.map(team => {
            const liveMatch = liveMatches.find(m => 
                m.home_team_id === team.id || m.away_team_id === team.id
            );

            return {
                ...team,
                is_live: !!liveMatch,
                live_match_id: liveMatch?.id || null,
            };
        });
    }

    /**
     * Get prioritized upcoming matches for discovery.
     * 1. Matches involving followed teams.
     * 2. Matches from major leagues.
     * Limited to 5 matches total.
     */
    async getPrioritizedMatches(userId: string, teamIds: string[]) {
        const now = new Date();
        const limit = 5;

        let prioritizedMatches: any[] = [];

        // 1. Get matches for followed teams
        if (teamIds.length > 0) {
            prioritizedMatches = await db.query.matchesTable.findMany({
                where: and(
                    gte(matchesTable.scheduled_at, now),
                    or(
                        inArray(matchesTable.home_team_id, teamIds),
                        inArray(matchesTable.away_team_id, teamIds)
                    )
                ),
                with: {
                    homeTeam: true,
                    awayTeam: true,
                    league: true,
                },
                orderBy: [asc(matchesTable.scheduled_at)],
                limit: limit,
            });
        }

        // 2. If we need more matches, fill with major leagues
        if (prioritizedMatches.length < limit) {
            const remainingLimit = limit - prioritizedMatches.length;
            const existingIds = prioritizedMatches.map(m => m.id);

            const majorLeagueMatches = await db.query.matchesTable.findMany({
                where: and(
                    gte(matchesTable.scheduled_at, now),
                    sql`EXISTS (SELECT 1 FROM leagues l WHERE l.id = ${matchesTable.league_id} AND l.is_major = true)`,
                    existingIds.length > 0 ? sql`${matchesTable.id} NOT IN (${sql.join(existingIds.map(id => sql`${id}`), sql`, `)})` : undefined
                ),
                with: {
                    homeTeam: true,
                    awayTeam: true,
                    league: true,
                },
                orderBy: [asc(matchesTable.scheduled_at)],
                limit: remainingLimit,
            });

            prioritizedMatches = [...prioritizedMatches, ...majorLeagueMatches];
        }

        return prioritizedMatches;
    }

    /**
     * Aggregate data for the Discover Home screen.
     */
    async getHomeData(userId: string, lat?: number, lng?: number) {
        const prefs = await db.query.userPreferencesTable.findFirst({
            where: eq(userPreferencesTable.user_id, userId),
        });

        const favSportIds = (prefs?.fav_sports || []) as string[];
        const favTeamIds = (prefs?.fav_team_ids || []) as string[];

        // Parallel fetch for all sections
        const [banners, followedTeams, popularCompetitions, recentlyViewed, upcomingMatches] = await Promise.all([
            this.discoveryRepository.getActiveBanners(favSportIds),
            this.getFollowedTeams(userId),
            this.discoveryRepository.getPopularCompetitions(),
            this.discoveryRepository.getVenueHistory(userId, 10),
            this.getPrioritizedMatches(userId, favTeamIds),
        ]);

        return {
            banners,
            followed_teams: followedTeams,
            popular_competitions: popularCompetitions,
            recently_viewed: recentlyViewed,
            upcoming_matches: upcomingMatches,
        };
    }

    async getVenueMenu(venueId: string) {
        const venue = await db.query.venuesTable.findFirst({
            where: eq(venuesTable.id, venueId),
            columns: {
                menu: true,
            },
        });

        return venue?.menu || [];
    }

    async getVenueHours(venueId: string) {
        const venue = await db.query.venuesTable.findFirst({
            where: eq(venuesTable.id, venueId),
            columns: {
                opening_hours: true,
            },
        });

        const exceptions = await db.query.openingHoursExceptionsTable.findMany({
            where: eq(openingHoursExceptionsTable.venue_id, venueId),
            orderBy: [asc(openingHoursExceptionsTable.date)],
        });

        return {
            regular_hours: venue?.opening_hours || [],
            exceptions,
        };
    }

    async getMatchesNearby(lat: number, lng: number, radiusKm: number = 10) {
        const distanceMeters = radiusKm * 1000;
        const now = new Date();

        // Get venue matches at nearby venues
        // We join with venuesTable to use the location for distance filtering
        const nearbyMatches = await db.select({
            venueMatch: venueMatchesTable,
            venue: venuesTable,
            match: matchesTable,
        })
        .from(venueMatchesTable)
        .innerJoin(venuesTable, eq(venueMatchesTable.venue_id, venuesTable.id))
        .innerJoin(matchesTable, eq(venueMatchesTable.match_id, matchesTable.id))
        .where(and(
            eq(venueMatchesTable.is_active, true),
            eq(venuesTable.is_active, true),
            isNull(venuesTable.deleted_at),
            gte(matchesTable.scheduled_at, now),
            sql`ST_DWithin(
                ${venuesTable.location}::geography, 
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 
                ${distanceMeters}
            )`,
        ))
        .orderBy(asc(matchesTable.scheduled_at));

        // Group by match or return as flat list depending on UX needs
        // For discovery, a flat list of "Match at Venue" is often best
        
        return nearbyMatches.map(item => ({
            ...item.match,
            venue: {
                id: item.venue.id,
                name: item.venue.name,
                address: item.venue.street_address,
                latitude: item.venue.latitude,
                longitude: item.venue.longitude,
                distance: item.venue.latitude && item.venue.longitude
                    ? this.calculateDistance(lat, lng, item.venue.latitude, item.venue.longitude)
                    : null,
            },
            venueMatchId: item.venueMatch.id,
            availableCapacity: item.venueMatch.available_capacity,
        }));
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; 
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}
