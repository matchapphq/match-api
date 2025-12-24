import { db } from "../config/config.db";
import { userFavoriteVenuesTable } from "../config/db/user-favorites.table";
import { venuesTable } from "../config/db/venues.table";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

export interface PaginationParams {
    page?: number;
    limit?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
}

export class FavoritesRepository {

    /**
     * Add venue to user's favorites
     * Returns null if venue doesn't exist
     * Throws on duplicate (handled by controller for 409)
     */
    async addFavorite(userId: string, venueId: string, note?: string) {
        // Check if venue exists
        const venue = await db.query.venuesTable.findFirst({
            where: and(
                eq(venuesTable.id, venueId),
                isNull(venuesTable.deleted_at)
            ),
            columns: { id: true, name: true }
        });

        if (!venue) {
            return { success: false, error: 'venue_not_found' };
        }

        // Check if already favorited (including soft-deleted)
        const existing = await db.query.userFavoriteVenuesTable.findFirst({
            where: and(
                eq(userFavoriteVenuesTable.user_id, userId),
                eq(userFavoriteVenuesTable.venue_id, venueId)
            )
        });

        if (existing) {
            // If soft-deleted, restore it
            if (existing.deleted_at) {
                const [restored] = await db.update(userFavoriteVenuesTable)
                    .set({
                        deleted_at: null,
                        note: note ?? existing.note,
                        updated_at: new Date()
                    })
                    .where(eq(userFavoriteVenuesTable.id, existing.id))
                    .returning();
                return { success: true, favorite: restored, restored: true };
            }
            // Already exists and not deleted
            return { success: false, error: 'already_favorited' };
        }

        // Create new favorite
        const [favorite] = await db.insert(userFavoriteVenuesTable)
            .values({
                user_id: userId,
                venue_id: venueId,
                note: note ?? null
            })
            .returning();

        return { success: true, favorite, restored: false };
    }

    /**
     * Remove venue from favorites (soft delete)
     */
    async removeFavorite(userId: string, venueId: string) {
        const [deleted] = await db.update(userFavoriteVenuesTable)
            .set({
                deleted_at: new Date(),
                updated_at: new Date()
            })
            .where(and(
                eq(userFavoriteVenuesTable.user_id, userId),
                eq(userFavoriteVenuesTable.venue_id, venueId),
                isNull(userFavoriteVenuesTable.deleted_at)
            ))
            .returning();

        return deleted;
    }

    /**
     * Update note on a favorite
     */
    async updateNote(userId: string, venueId: string, note: string | null) {
        const [updated] = await db.update(userFavoriteVenuesTable)
            .set({
                note,
                updated_at: new Date()
            })
            .where(and(
                eq(userFavoriteVenuesTable.user_id, userId),
                eq(userFavoriteVenuesTable.venue_id, venueId),
                isNull(userFavoriteVenuesTable.deleted_at)
            ))
            .returning();

        return updated;
    }

    /**
     * Get user's favorite venues with pagination
     * Excludes soft-deleted favorites and venues
     */
    async getFavorites(userId: string, params: PaginationParams = {}): Promise<PaginatedResult<any>> {
        const page = Math.max(1, params.page ?? 1);
        const limit = Math.min(100, Math.max(1, params.limit ?? 20));
        const offset = (page - 1) * limit;

        // Get total count
        const countResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(userFavoriteVenuesTable)
            .innerJoin(venuesTable, eq(userFavoriteVenuesTable.venue_id, venuesTable.id))
            .where(and(
                eq(userFavoriteVenuesTable.user_id, userId),
                isNull(userFavoriteVenuesTable.deleted_at),
                isNull(venuesTable.deleted_at)
            ));

        const total = countResult[0]?.count ?? 0;

        // Get favorites with venue details (excluding geometry to avoid parsing issues)
        const favorites = await db.select({
            id: userFavoriteVenuesTable.id,
            venue_id: userFavoriteVenuesTable.venue_id,
            note: userFavoriteVenuesTable.note,
            created_at: userFavoriteVenuesTable.created_at,
            updated_at: userFavoriteVenuesTable.updated_at,
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
            .from(userFavoriteVenuesTable)
            .innerJoin(venuesTable, eq(userFavoriteVenuesTable.venue_id, venuesTable.id))
            .where(and(
                eq(userFavoriteVenuesTable.user_id, userId),
                isNull(userFavoriteVenuesTable.deleted_at),
                isNull(venuesTable.deleted_at)
            ))
            .orderBy(desc(userFavoriteVenuesTable.created_at))
            .limit(limit)
            .offset(offset);

        const totalPages = Math.ceil(total / limit);

        return {
            data: favorites,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages
            }
        };
    }

    /**
     * Check if a venue is favorited by user
     */
    async isFavorited(userId: string, venueId: string): Promise<boolean> {
        const favorite = await db.query.userFavoriteVenuesTable.findFirst({
            where: and(
                eq(userFavoriteVenuesTable.user_id, userId),
                eq(userFavoriteVenuesTable.venue_id, venueId),
                isNull(userFavoriteVenuesTable.deleted_at)
            ),
            columns: { id: true }
        });

        return !!favorite;
    }

    /**
     * Get a single favorite by user and venue
     */
    async getFavorite(userId: string, venueId: string) {
        return await db.query.userFavoriteVenuesTable.findFirst({
            where: and(
                eq(userFavoriteVenuesTable.user_id, userId),
                eq(userFavoriteVenuesTable.venue_id, venueId),
                isNull(userFavoriteVenuesTable.deleted_at)
            )
        });
    }
}
