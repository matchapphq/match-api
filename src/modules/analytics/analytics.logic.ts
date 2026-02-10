import { AnalyticsRepository } from "../../repository/analytics.repository";
import type { GroupByPeriod } from "../../repository/analytics.repository";

export class AnalyticsLogic {
    constructor(private readonly analyticsRepo: AnalyticsRepository) {}

    async isVenueOwner(venueId: string, userId: string) {
        return await this.analyticsRepo.isVenueOwner(venueId, userId);
    }

    async getVenueBasicInfo(venueId: string) {
        return await this.analyticsRepo.getVenueBasicInfo(venueId);
    }

    async getVenueOverview(venueId: string, startDate?: Date, endDate?: Date) {
        return await this.analyticsRepo.getOverview(venueId, {
            startDate,
            endDate
        });
    }

    async getReservationTrends(venueId: string, startDate?: Date, endDate?: Date, groupBy: GroupByPeriod = 'day') {
        return await this.analyticsRepo.getReservationTrends(venueId, {
            startDate,
            endDate,
            groupBy
        });
    }

    async getRevenueTrends(venueId: string, startDate?: Date, endDate?: Date, groupBy: GroupByPeriod = 'day') {
        return await this.analyticsRepo.getRevenueTrends(venueId, {
            startDate,
            endDate,
            groupBy
        });
    }
}
