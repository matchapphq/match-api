import { db } from "../../config/config.db";
import { venuesTable } from "../../config/db/venues.table";
import { matchesTable } from "../../config/db/matches.table";
import { eq, and, gte, lte, ilike, or, isNull, asc, desc, sql } from "drizzle-orm";

export class DiscoveryLogic {
    async search(params: any) {
        const {
            q = "",
            type = "all",
            page = "1",
            limit = "15",
            lat,
            lng,
            radius_km = "50",
            date
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
                eq(venuesTable.is_active, true)
            ];

            if (searchQuery) {
                venueConditions.push(or(
                    ilike(venuesTable.name, `%${searchQuery}%`),
                    ilike(venuesTable.city, `%${searchQuery}%`),
                    ilike(venuesTable.type, `%${searchQuery}%`)
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
                with: { photos: true }
            });

            if (userLat && userLng) {
                venues = venues.map(v => ({
                    ...v,
                    distance: v.latitude && v.longitude
                        ? this.calculateDistance(userLat, userLng, v.latitude, v.longitude)
                        : null
                }));
            }
        }

        if (type === "all" || type === "matches") {
            const matchConditions = [
                gte(matchesTable.scheduled_at, new Date())
            ];

            if (date) {
                const filterDate = new Date(date);
                const nextDay = new Date(filterDate);
                nextDay.setDate(nextDay.getDate() + 1);
                matchConditions.push(gte(matchesTable.scheduled_at, filterDate));
                matchConditions.push(lte(matchesTable.scheduled_at, nextDay));
            }

            const matchWhere = and(...matchConditions);

            let allMatches = await db.query.matchesTable.findMany({
                where: matchWhere,
                with: {
                    homeTeam: true,
                    awayTeam: true,
                    league: true,
                },
                orderBy: [asc(matchesTable.scheduled_at)],
            });

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
            }
        };
    }

    async getNearby() {
        return { msg: "Nearby venues" };
    }

    async getVenueDetails(venueId: string) {
        return { msg: "Venue details" };
    }

    async getVenueMenu(venueId: string) {
        return { msg: "Venue menu" };
    }

    async getVenueHours(venueId: string) {
        return { msg: "Venue hours" };
    }

    async getMatchesNearby() {
        return { msg: "Matches nearby" };
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
