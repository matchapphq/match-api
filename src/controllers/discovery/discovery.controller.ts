import { createFactory } from "hono/factory";
import { db } from "../../config/config.db";
import { venuesTable } from "../../config/db/venues.table";
import { matchesTable } from "../../config/db/matches.table";
import { eq, and, gte, lte, ilike, or, isNull, asc, desc, sql } from "drizzle-orm";

/**
 * Controller for Discovery and Map operations.
 * Handles searching for venues, getting nearby places, and venue details for the map view.
 */
class DiscoveryController {
    private readonly factory = createFactory();

    readonly getNearby = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Nearby venues" });
    });

    readonly getVenueDetails = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Venue details" });
    });

    readonly getVenueMenu = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Venue menu" });
    });

    readonly getVenueHours = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Venue hours" });
    });

    readonly getMatchesNearby = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Matches nearby" });
    });

    /**
     * GET /discovery/search - Paginated search for venues and matches
     * Query params:
     * - q: search query string
     * - type: "all" | "matches" | "venues"
     * - page: page number (1-indexed)
     * - limit: items per page (default 15)
     * - lat, lng: user coordinates for geo-filtering
     * - radius_km: search radius in km (default 50)
     * - date: filter matches by date (YYYY-MM-DD)
     */
    readonly search = this.factory.createHandlers(async (ctx) => {
        try {
            const {
                q = "",
                type = "all",
                page = "1",
                limit = "15",
                lat,
                lng,
                radius_km = "50",
                date
            } = ctx.req.query();

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

            // Fetch venues if type is "all" or "venues"
            if (type === "all" || type === "venues") {
                const venueConditions = [
                    isNull(venuesTable.deleted_at),
                    eq(venuesTable.is_active, true)
                ];

                // Text search on name, city, type
                if (searchQuery) {
                    venueConditions.push(or(
                        ilike(venuesTable.name, `%${searchQuery}%`),
                        ilike(venuesTable.city, `%${searchQuery}%`),
                        ilike(venuesTable.type, `%${searchQuery}%`)
                    )!);
                }

                // Geo filter
                if (userLat && userLng) {
                    const distanceMeters = radiusKm * 1000;
                    venueConditions.push(sql`ST_DWithin(
                        ${venuesTable.location}::geography, 
                        ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography, 
                        ${distanceMeters}
                    )`);
                }

                const venueWhere = and(...venueConditions);

                // Count total
                const [venueCount] = await db.select({ count: sql<number>`count(*)` })
                    .from(venuesTable)
                    .where(venueWhere);
                totalVenues = Number(venueCount?.count ?? 0);

                // Fetch paginated venues with distance
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
                    with: { photos: true }
                });

                // Add distance to each venue if coordinates provided
                if (userLat && userLng) {
                    venues = venues.map(v => ({
                        ...v,
                        distance: v.latitude && v.longitude
                            ? this.calculateDistance(userLat, userLng, v.latitude, v.longitude)
                            : null
                    }));
                }
            }

            // Fetch matches if type is "all" or "matches"
            if (type === "all" || type === "matches") {
                const matchConditions = [
                    gte(matchesTable.scheduled_at, new Date())
                ];

                // Text search on teams and league
                if (searchQuery) {
                    // We'll filter after fetching since team/league are relations
                }

                // Date filter
                if (date) {
                    const filterDate = new Date(date);
                    const nextDay = new Date(filterDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    matchConditions.push(gte(matchesTable.scheduled_at, filterDate));
                    matchConditions.push(lte(matchesTable.scheduled_at, nextDay));
                }

                const matchWhere = and(...matchConditions);

                // Fetch matches with relations
                let allMatches = await db.query.matchesTable.findMany({
                    where: matchWhere,
                    with: {
                        homeTeam: true,
                        awayTeam: true,
                        league: true,
                    },
                    orderBy: [asc(matchesTable.scheduled_at)],
                });

                // Filter by search query on team names and league
                if (searchQuery) {
                    allMatches = allMatches.filter(m => {
                        const homeName = (m.homeTeam?.name || "").toLowerCase();
                        const awayName = (m.awayTeam?.name || "").toLowerCase();
                        const leagueName = (m.league?.name || "").toLowerCase();
                        return homeName.includes(searchQuery) ||
                               awayName.includes(searchQuery) ||
                               leagueName.includes(searchQuery);
                    });
                }

                totalMatches = allMatches.length;
                matches = allMatches.slice(offset, offset + limitNum);
            }

            return ctx.json({
                venues,
                matches,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    totalVenues,
                    totalMatches,
                    hasMoreVenues: offset + venues.length < totalVenues,
                    hasMoreMatches: offset + matches.length < totalMatches,
                }
            });
        } catch (error: any) {
            console.error("Discovery search error:", error);
            return ctx.json({ error: "Search failed" }, 500);
        }
    });

    /**
     * Calculate distance between two points using Haversine formula
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10; // Round to 1 decimal
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}

export default DiscoveryController;
