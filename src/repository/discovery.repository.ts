import { db } from "../config/config.db";
import { userVenueHistoryTable } from "../config/db/user-history.table";
import { venuesTable } from "../config/db/venues.table";
import { heroBannersTable, tournamentsTable } from "../config/db/curation.table";
import { sportsTable, leaguesTable } from "../config/db/sports.table";
import { matchesTable } from "../config/db/matches.table";
import { eq, and, desc, sql, isNull, inArray, gte, asc } from "drizzle-orm";

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
     */
    async getActiveBanners(favSportIds: string[] = []) {
        const conditions = [eq(heroBannersTable.is_active, true)];
        
        if (favSportIds.length > 0) {
            conditions.push(inArray(heroBannersTable.sport_id, favSportIds));
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
     * Get popular sports/competitions that have active matches in the next 7 days.
     */
    async getPopularCompetitions() {
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        // This query finds sports that have at least one match scheduled in the next week
        return await db.select({
            id: sportsTable.id,
            name: sportsTable.name,
            slug: sportsTable.slug,
            icon_url: sportsTable.icon_url,
        })
        .from(sportsTable)
        .where(and(
            eq(sportsTable.is_active, true),
            sql`EXISTS (
                SELECT 1 FROM ${leaguesTable} l
                JOIN ${matchesTable} m ON m.league_id = l.id
                WHERE l.sport_id = ${sportsTable.id}
                AND m.scheduled_at >= ${now}
                AND m.scheduled_at <= ${nextWeek}
            )`
        ))
        .orderBy(asc(sportsTable.display_order));
    }
}
