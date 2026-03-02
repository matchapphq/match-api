import { db } from "../config/config.db";
import { reviewsTable, reviewHelpfulTable } from "../config/db/reviews.table";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import type { NewReview, NewReviewHelpful } from "../config/db/reviews.table";

export class ReviewsRepository {
    async create(review: NewReview) {
        const [newReview] = await db.insert(reviewsTable).values(review).returning();
        return newReview;
    }

    async findByVenueId(venueId: string, page: number = 1, limit: number = 20) {
        const offset = (page - 1) * limit;
        
        // 1. Get total count for pagination metadata
        const [countRes] = await db.select({ count: sql<number>`count(*)` })
            .from(reviewsTable)
            .where(and(
                eq(reviewsTable.venue_id, venueId),
                isNull(reviewsTable.deleted_at)
            ));

        const total = Number(countRes?.count ?? 0);
        const totalPages = Math.ceil(total / limit);

        // 2. Fetch data
        const reviews = await db.query.reviewsTable.findMany({
            where: and(
                eq(reviewsTable.venue_id, venueId),
                isNull(reviewsTable.deleted_at)
            ),
            limit: limit,
            offset: offset,
            orderBy: desc(reviewsTable.created_at),
            with: {
                // @ts-ignore
                user: {
                    columns: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        avatar_url: true
                    }
                }
            }
        });

        return {
            data: reviews,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        };
    }

    async findById(reviewId: string) {
        return await db.query.reviewsTable.findFirst({
            where: and(
                eq(reviewsTable.id, reviewId),
                isNull(reviewsTable.deleted_at)
            )
        });
    }

    async update(reviewId: string, userId: string, content: string, rating: number) {
        const [updatedReview] = await db.update(reviewsTable)
            .set({ 
                content, 
                rating,
                updated_at: new Date() 
            })
            .where(and(
                eq(reviewsTable.id, reviewId),
                eq(reviewsTable.user_id, userId)
            ))
            .returning();
        return updatedReview;
    }

    async delete(reviewId: string, userId: string) {
        const [deletedReview] = await db.update(reviewsTable)
            .set({ deleted_at: new Date() })
            .where(and(
                eq(reviewsTable.id, reviewId),
                eq(reviewsTable.user_id, userId)
            ))
            .returning();
        return deletedReview;
    }

    async addHelpfulVote(vote: NewReviewHelpful) {
        // Check if vote already exists
        const existingVote = await db.query.reviewHelpfulTable.findFirst({
            where: and(
                eq(reviewHelpfulTable.review_id, vote.review_id),
                eq(reviewHelpfulTable.user_id, vote.user_id)
            )
        });

        if (existingVote) {
            if (existingVote.is_helpful === vote.is_helpful) {
                return existingVote; // No change
            }
            
            // Update existing vote
            await db.update(reviewHelpfulTable)
                .set({ is_helpful: vote.is_helpful })
                .where(eq(reviewHelpfulTable.id, existingVote.id));
        } else {
            // Create new vote
            await db.insert(reviewHelpfulTable).values(vote);
        }

        // Update counts on review table
        const [helpfulCount] = await db.select({ count: sql<number>`count(*)` })
            .from(reviewHelpfulTable)
            .where(and(
                eq(reviewHelpfulTable.review_id, vote.review_id),
                eq(reviewHelpfulTable.is_helpful, true)
            ));
            
        const [unhelpfulCount] = await db.select({ count: sql<number>`count(*)` })
            .from(reviewHelpfulTable)
            .where(and(
                eq(reviewHelpfulTable.review_id, vote.review_id),
                eq(reviewHelpfulTable.is_helpful, false)
            ));

        await db.update(reviewsTable)
            .set({
                helpful_count: Number(helpfulCount?.count ?? 0),
                unhelpful_count: Number(unhelpfulCount?.count ?? 0)
            })
            .where(eq(reviewsTable.id, vote.review_id));

        return true;
    }
}
