import { ReviewsRepository } from "../../repository/reviews.repository";

export class ReviewsLogic {
    private readonly repository: ReviewsRepository;

    constructor() {
        this.repository = new ReviewsRepository();
    }

    async createReview(userId: string, venueId: string, data: any) {
        return await this.repository.create({
            user_id: userId,
            venue_id: venueId,
            ...data
        });
    }

    async getVenueReviews(venueId: string, page: number = 1, limit: number = 20) {
        const offset = (page - 1) * limit;
        return await this.repository.findByVenueId(venueId, limit, offset);
    }

    async getVenueReviewStats(venueId: string) {
        return await this.repository.getRatingDistribution(venueId);
    }

    async deleteReview(reviewId: string, userId: string) {
        const result = await this.repository.delete(reviewId, userId);
        if (!result) {
            throw new Error("REVIEW_NOT_FOUND_OR_UNAUTHORIZED");
        }
        return true;
    }

    async toggleHelpful(reviewId: string, userId: string, isHelpful: boolean) {
        return await this.repository.markHelpful(reviewId, userId, isHelpful);
    }
}
