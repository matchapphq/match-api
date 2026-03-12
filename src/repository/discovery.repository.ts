import { db } from "../config/config.db";
import { userVenueHistoryTable } from "../config/db/user-history.table";
import { venuesTable } from "../config/db/venues.table";
import { heroBannersTable, tournamentsTable } from "../config/db/curation.table";
import { sportsTable, leaguesTable } from "../config/db/sports.table";
import { matchesTable } from "../config/db/matches.table";
import { eq, and, or, desc, sql, isNull, inArray, gte, asc } from "drizzle-orm";

export class DiscoveryRepository {
    /**
     * Record a venue view for a user.
     * Keeps history lean by only storing the latest view for a specific user-venue pair.
     */
    async recordVenueView(userId: string, venueId: string) {
        // Check if venue exists and is not deleted
        const venue = await db.query.venuesTable.findFirst({
            where: and(
                eq(venuesTable.id, venueId),
                isNull(venuesTable.deleted_at)
            ),
            columns: { id: true }
        });

        if (!venue) return null;

        // Use UPSERT logic: delete old view if exists, then insert new one
        // This ensures the latest view is always the one stored and keeps history clean
        await db.delete(userVenueHistoryTable)
            .where(and(
                eq(userVenueHistoryTable.user_id, userId),
                eq(userVenueHistoryTable.venue_id, venueId)
            ));

        const [history] = await db.insert(userVenueHistoryTable)
            .values({
                user_id: userId,
                venue_id: venueId,
                viewed_at: new Date(),
            })
            .returning();

        return history;
    }

    /**
     * Get user's recently viewed venues.
     */
    async getVenueHistory(userId: string, limit: number = 10) {
        return await db.select({
            id: userVenueHistoryTable.id,
            venue_id: userVenueHistoryTable.venue_id,
            viewed_at: userVenueHistoryTable.viewed_at,
            venue: {
                id: venuesTable.id,
                name: venuesTable.name,
                description: venuesTable.description,
                type: venuesTable.type,
                city: venuesTable.city,
                street_address: venuesTable.street_address,
                latitude: venuesTable.latitude,
                longitude: venuesTable.longitude,
                logo_url: venuesTable.logo_url,
                cover_image_url: venuesTable.cover_image_url,
                average_rating: venuesTable.average_rating,
                total_reviews: venuesTable.total_reviews,
            }
        })
        .from(userVenueHistoryTable)
        .innerJoin(venuesTable, eq(userVenueHistoryTable.venue_id, venuesTable.id))
        .where(and(
            eq(userVenueHistoryTable.user_id, userId),
            isNull(venuesTable.deleted_at)
        ))
        .orderBy(desc(userVenueHistoryTable.viewed_at))
        .limit(limit);
    }

    /**
     * Clear user's venue history.
     */
    async clearVenueHistory(userId: string) {
        return await db.delete(userVenueHistoryTable)
            .where(eq(userVenueHistoryTable.user_id, userId));
    }

    /**
     * Get active hero banners filtered by user's favorite sports.
     * Supports both UUIDs and slugs for sport identification.
     */
    async getActiveBanners(favSportIdentifiers: string[] = []) {
        const conditions = [eq(heroBannersTable.is_active, true)];
        
        if (favSportIdentifiers.length > 0) {
            // Check if identifiers are UUIDs or slugs
            const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
            const uuids = favSportIdentifiers.filter(isUuid);
            const slugs = favSportIdentifiers.filter(s => !isUuid(s));

            const sportFilterConditions = [];
            if (uuids.length > 0) {
                sportFilterConditions.push(inArray(heroBannersTable.sport_id, uuids));
            }
            
            if (slugs.length > 0) {
                // To filter by slug, we need to join with sportsTable
                const matchingSports = await db.query.sportsTable.findMany({
                    where: inArray(sportsTable.slug, slugs),
                    columns: { id: true }
                });
                const slugBasedIds = matchingSports.map(s => s.id);
                if (slugBasedIds.length > 0) {
                    sportFilterConditions.push(inArray(heroBannersTable.sport_id, slugBasedIds));
                }
            }

            if (sportFilterConditions.length > 0) {
                conditions.push(or(...sportFilterConditions)!);
            }
        }

        return await db.query.heroBannersTable.findMany({
            where: and(...conditions),
            orderBy: [asc(heroBannersTable.display_order)],
            with: {
                sport: true,
                tournament: true,
            }
        });
    }

    /**
     * Get popular competitions (leagues) limited to 3 per sport.
     * Prioritizes major leagues within each sport.
     */
    async getPopularCompetitions() {
        // Use a CTE with ROW_NUMBER to limit results per sport_id
        const sq = db.select({
            id: leaguesTable.id,
            name: leaguesTable.name,
            slug: leaguesTable.slug,
            logo_url: leaguesTable.logo_url,
            is_major: leaguesTable.is_major,
            sport_id: leaguesTable.sport_id,
            row_number: sql<number>`ROW_NUMBER() OVER(PARTITION BY ${leaguesTable.sport_id} ORDER BY ${leaguesTable.is_major} DESC, ${leaguesTable.display_order} ASC, ${leaguesTable.name} ASC)`.as('rn')
        })
        .from(leaguesTable)
        .where(eq(leaguesTable.is_active, true))
        .as('sq');

        return await db.select({
            id: sq.id,
            name: sq.name,
            slug: sq.slug,
            logo_url: sq.logo_url,
            is_major: sq.is_major,
        })
        .from(sq)
        .where(sql`${sq.row_number} <= 3`)
        .orderBy(desc(sq.is_major), asc(sq.name));
    }
}
