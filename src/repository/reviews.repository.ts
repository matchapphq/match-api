import { db } from "../config/config.db";
import { reviewsTable, reviewHelpfulTable } from "../config/db/reviews.table";
import { venuesTable } from "../config/db/venues.table";
import { eq, and, desc, sql, isNull, avg, count } from "drizzle-orm";

export class ReviewsRepository {
    async create(data: any) {
        return await db.transaction(async (tx) => {
            const [newReview] = await tx.insert(reviewsTable).values({
                user_id: data.user_id,
                venue_id: data.venue_id,
                rating: data.rating,
                content: data.content,
                tags: data.tags || [],
                title: data.title || "",
                atmosphere_rating: data.atmosphere_rating,
                food_rating: data.food_rating,
                service_rating: data.service_rating,
                value_rating: data.value_rating,
            }).returning();

            // Update venue average rating and total reviews
            const [stats] = await tx.select({
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
                isNull(reviewsTable.deleted_at)
            ));

            if (stats) {
                await tx.update(venuesTable)
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

            return newReview;
        });
    }

    async findByVenueId(venueId: string, limit: number = 20, offset: number = 0) {
        return await db.query.reviewsTable.findMany({
            where: and(
                eq(reviewsTable.venue_id, venueId),
                isNull(reviewsTable.deleted_at)
            ),
            orderBy: [desc(reviewsTable.created_at)],
            limit,
            offset,
            with: {
                // Assuming relations are defined in relations.ts
                // @ts-ignore
                user: {
                    columns: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        avatar: true,
                    }
                }
            }
        });
    }

    async delete(reviewId: string, userId: string) {
        const [review] = await db.select()
            .from(reviewsTable)
            .where(and(
                eq(reviewsTable.id, reviewId),
                eq(reviewsTable.user_id, userId)
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
            isNull(reviewsTable.deleted_at)
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

    async markHelpful(reviewId: string, userId: string, isHelpful: boolean) {
        return await db.transaction(async (tx) => {
            // Upsert helpful vote
            await tx.insert(reviewHelpfulTable)
                .values({
                    review_id: reviewId,
                    user_id: userId,
                    is_helpful: isHelpful,
                })
                .onConflictDoUpdate({
                    target: [reviewHelpfulTable.review_id, reviewHelpfulTable.user_id],
                    set: { is_helpful: isHelpful }
                });

            // Recalculate helpful counts
            const [helpfulCount] = await tx.select({ count: count() })
                .from(reviewHelpfulTable)
                .where(and(
                    eq(reviewHelpfulTable.review_id, reviewId),
                    eq(reviewHelpfulTable.is_helpful, true)
                ));

            const [unhelpfulCount] = await tx.select({ count: count() })
                .from(reviewHelpfulTable)
                .where(and(
                    eq(reviewHelpfulTable.review_id, reviewId),
                    eq(reviewHelpfulTable.is_helpful, false)
                ));

            await tx.update(reviewsTable)
                .set({
                    helpful_count: Number(helpfulCount?.count || 0),
                    unhelpful_count: Number(unhelpfulCount?.count || 0),
                })
                .where(eq(reviewsTable.id, reviewId));

            return true;
        });
    }
}
