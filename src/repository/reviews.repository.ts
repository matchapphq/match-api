import { db } from "../config/config.db";
import { reviewsTable, reviewHelpfulTable } from "../config/db/reviews.table";
import { venuesTable } from "../config/db/venues.table";
import { usersTable } from "../config/db/user.table";
import { eq, and, desc, sql, isNull, avg, count, inArray } from "drizzle-orm";

export class ReviewsRepository {
    async create(data: any) {
        const [newReview] = await db.insert(reviewsTable).values({
            user_id: data.user_id,
            venue_id: data.venue_id,
            rating: data.rating,
            content: data.content,
            title: data.title || "",
            atmosphere_rating: data.atmosphere_rating,
            food_rating: data.food_rating,
            service_rating: data.service_rating,
            value_rating: data.value_rating,
            photos_urls: data.photos_urls || [],
        }).returning();

        if (newReview) {
            // Update venue average rating and total reviews (sequentially since transactions are not supported in neon-http)
            const [stats] = await db.select({
                avgRating: avg(reviewsTable.rating),
                avgAtmosphere: avg(reviewsTable.atmosphere_rating),
                avgFood: avg(reviewsTable.food_rating),
                avgService: avg(reviewsTable.service_rating),
                avgValue: avg(reviewsTable.value_rating),
                totalReviews: count(reviewsTable.id),
            })
            .from(reviewsTable)
            .where(and(
                eq(reviewsTable.venue_id, data.venue_id),
                isNull(reviewsTable.deleted_at),
            ));

            if (stats) {
                await db.update(venuesTable)
                    .set({
                        average_rating: stats.avgRating?.toString() || "0.00",
                        average_atmosphere_rating: stats.avgAtmosphere?.toString() || "0.00",
                        average_food_rating: stats.avgFood?.toString() || "0.00",
                        average_service_rating: stats.avgService?.toString() || "0.00",
                        average_value_rating: stats.avgValue?.toString() || "0.00",
                        total_reviews: Number(stats.totalReviews),
                    })
                    .where(eq(venuesTable.id, data.venue_id));
            }
        }

        return newReview;
    }

    async findByVenueId(venueId: string, limit: number = 20, offset: number = 0, currentUserId?: string) {
        // Query reviews with optional is_helpful join if currentUserId is provided
        const reviews = await db.select({
            id: reviewsTable.id,
            user_id: reviewsTable.user_id,
            venue_id: reviewsTable.venue_id,
            rating: reviewsTable.rating,
            title: reviewsTable.title,
            content: reviewsTable.content,
            photos_urls: reviewsTable.photos_urls,
            helpful_count: reviewsTable.helpful_count,
            unhelpful_count: reviewsTable.unhelpful_count,
            created_at: reviewsTable.created_at,
            atmosphere_rating: reviewsTable.atmosphere_rating,
            food_rating: reviewsTable.food_rating,
            service_rating: reviewsTable.service_rating,
            value_rating: reviewsTable.value_rating,
            // Check if current user found this review helpful
            is_helpful: currentUserId 
                ? sql<boolean>`EXISTS (
                    SELECT 1 FROM ${reviewHelpfulTable} 
                    WHERE ${reviewHelpfulTable.review_id} = ${reviewsTable.id} 
                    AND ${reviewHelpfulTable.user_id} = ${currentUserId} 
                    AND ${reviewHelpfulTable.is_helpful} = true
                )`
                : sql<boolean>`false`,
        })
        .from(reviewsTable)
        .where(and(
            eq(reviewsTable.venue_id, venueId),
            isNull(reviewsTable.deleted_at),
        ))
        .orderBy(desc(reviewsTable.created_at))
        .limit(limit)
        .offset(offset);

        // Fetch user data for each review manually or using a join
        // For simplicity and matching existing findMany with relations, we'll map the reviews
        const reviewUserIds = [...new Set(reviews.map(r => r.user_id).filter(Boolean))];
        if (reviewUserIds.length === 0) return reviews.map(r => ({ ...r, user: null }));

        // Fetch users in a separate query to match findMany's with: { user: ... }
        const users = await db.select({
            id: usersTable.id,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
            avatar_url: usersTable.avatar_url,
        })
        .from(usersTable)
        .where(inArray(usersTable.id, reviewUserIds));

        // @ts-ignore - formatting to match original structure
        return reviews.map(review => ({
            ...review,
            user: users.find(u => u.id === review.user_id)
        }));
    }

    async delete(reviewId: string, userId: string) {
        const [review] = await db.select()
            .from(reviewsTable)
            .where(and(
                eq(reviewsTable.id, reviewId),
                eq(reviewsTable.user_id, userId),
            ));

        if (!review) return null;

        await db.update(reviewsTable)
            .set({ deleted_at: new Date() })
            .where(eq(reviewsTable.id, reviewId));

        // Update venue stats after deletion
        const [stats] = await db.select({
            avgRating: avg(reviewsTable.rating),
            avgAtmosphere: avg(reviewsTable.atmosphere_rating),
            avgFood: avg(reviewsTable.food_rating),
            avgService: avg(reviewsTable.service_rating),
            avgValue: avg(reviewsTable.value_rating),
            totalReviews: count(reviewsTable.id),
        })
        .from(reviewsTable)
        .where(and(
            eq(reviewsTable.venue_id, review.venue_id),
            isNull(reviewsTable.deleted_at),
        ));

        await db.update(venuesTable)
            .set({
                average_rating: stats?.avgRating?.toString() || "0.00",
                average_atmosphere_rating: stats?.avgAtmosphere?.toString() || "0.00",
                average_food_rating: stats?.avgFood?.toString() || "0.00",
                average_service_rating: stats?.avgService?.toString() || "0.00",
                average_value_rating: stats?.avgValue?.toString() || "0.00",
                total_reviews: Number(stats?.totalReviews || 0),
            })
            .where(eq(venuesTable.id, review.venue_id));

        return true;
    }

    async getRatingDistribution(venueId: string) {
        const stats = await db.select({
            rating: reviewsTable.rating,
            count: count(),
        })
        .from(reviewsTable)
        .where(and(
            eq(reviewsTable.venue_id, venueId),
            isNull(reviewsTable.deleted_at),
        ))
        .groupBy(reviewsTable.rating);

        // Convert to a fixed 1-5 distribution
        const distribution = [
            { stars: 5, count: 0 },
            { stars: 4, count: 0 },
            { stars: 3, count: 0 },
            { stars: 2, count: 0 },
            { stars: 1, count: 0 },
        ];

        let total = 0;
        stats.forEach(s => {
            const item = distribution.find(d => d.stars === s.rating);
            if (item) {
                item.count = Number(s.count);
                total += item.count;
            }
        });

        return distribution.map(d => ({
            stars: d.stars,
            count: d.count,
            percentage: total > 0 ? Math.round((d.count / total) * 100) : 0,
        }));
    }

    async markHelpful(reviewId: string, userId: string, isHelpful: boolean) {
        // Only allow marking as helpful (true) to ensure "like only once"
        if (!isHelpful) return true;

        // Upsert helpful vote
        await db.insert(reviewHelpfulTable)
            .values({
                review_id: reviewId,
                user_id: userId,
                is_helpful: true,
            })
            .onConflictDoNothing(); // Once liked, it stays liked

        // Recalculate helpful counts
        const [helpfulCount] = await db.select({ count: count() })
            .from(reviewHelpfulTable)
            .where(and(
                eq(reviewHelpfulTable.review_id, reviewId),
                eq(reviewHelpfulTable.is_helpful, true),
            ));

        await db.update(reviewsTable)
            .set({
                helpful_count: Number(helpfulCount?.count || 0),
            })
            .where(eq(reviewsTable.id, reviewId));

        return true;
    }
}
