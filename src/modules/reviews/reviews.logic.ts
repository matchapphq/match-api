import { ReviewsRepository } from "../../repository/reviews.repository";
import { FidelityLogic } from "../fidelity/fidelity.logic";

export class ReviewsLogic {
    private readonly repository: ReviewsRepository;
    private readonly fidelityLogic: FidelityLogic;

    constructor() {
        this.repository = new ReviewsRepository();
        this.fidelityLogic = new FidelityLogic();
    }

    async createReview(userId: string, venueId: string, data: any) {
        const review = await this.repository.create({
            user_id: userId,
            venue_id: venueId,
            ...data,
        });

        if (review) {
            // Beta Challenge Points
            const isComplete = (data.comment?.length > 100) || (data.photos?.length > 0);
            const actionKey = isComplete ? "BETA_REVIEW_COMPLETE" : "BETA_REVIEW_SHORT";
            
            await this.fidelityLogic.awardPoints({
                userId,
                actionKey,
                referenceId: review.id,
                referenceType: "review",
                metadata: { venueId }
            }).catch(err => console.error("[BetaChallenge] Failed to award review points:", err));
        }

        return review;
    }

    async getVenueReviews(venueId: string, page: number = 1, limit: number = 20, userId?: string) {
        const offset = (page - 1) * limit;
        return await this.repository.findByVenueId(venueId, limit, offset, userId);
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
