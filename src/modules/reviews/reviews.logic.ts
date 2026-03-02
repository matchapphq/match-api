import { ReviewsRepository } from "../../repository/reviews.repository";
import type { NewReview, NewReviewHelpful } from "../../config/db/reviews.table";

export class ReviewsLogic {
    constructor(private readonly reviewsRepository: ReviewsRepository) {}

    async createReview(review: NewReview) {
        return await this.reviewsRepository.create(review);
    }

    async getVenueReviews(venueId: string, page: number, limit: number) {
        return await this.reviewsRepository.findByVenueId(venueId, page, limit);
    }

    async updateReview(reviewId: string, userId: string, content: string, rating: number) {
        const review = await this.reviewsRepository.findById(reviewId);
        if (!review) {
            throw new Error("Review not found");
        }
        if (review.user_id !== userId) {
            throw new Error("Unauthorized");
        }
        return await this.reviewsRepository.update(reviewId, userId, content, rating);
    }

    async deleteReview(reviewId: string, userId: string) {
        const review = await this.reviewsRepository.findById(reviewId);
        if (!review) {
            throw new Error("Review not found");
        }
        if (review.user_id !== userId) {
            throw new Error("Unauthorized");
        }
        return await this.reviewsRepository.delete(reviewId, userId);
    }

    async markHelpful(vote: NewReviewHelpful) {
        return await this.reviewsRepository.addHelpfulVote(vote);
    }
}
