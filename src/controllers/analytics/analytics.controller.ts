import type { Context } from "hono";
import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { z } from "zod";
import { AnalyticsRepository } from "../../repository/analytics.repository";
import type { GroupByPeriod } from "../../repository/analytics.repository";
import type { HonoEnv } from "../../types/hono.types";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const DateRangeSchema = z.object({
    start_date: z.string().optional().transform(v => v ? new Date(v) : undefined),
    end_date: z.string().optional().transform(v => v ? new Date(v) : undefined),
});

const TrendQuerySchema = DateRangeSchema.extend({
    group_by: z.enum(['day', 'week', 'month']).optional().default('day'),
});

/**
 * Controller for Analytics operations.
 * All endpoints require venue owner access.
 */
class AnalyticsController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly analyticsRepo = new AnalyticsRepository();

    /**
     * Helper to get user ID from context
     */
    private getUserId(ctx: Context<HonoEnv>): string {
        const user = ctx.get('user');
        if (!user || !user.id) {
            throw new Error("Unauthorized");
        }
        return user.id;
    }

    /**
     * Helper to verify venue ownership
     */
    private async verifyOwnership(ctx: Context<HonoEnv>, venueId: string): Promise<boolean> {
        const userId = this.getUserId(ctx);
        return await this.analyticsRepo.isVenueOwner(venueId, userId);
    }

    /**
     * GET /venues/:venueId/analytics/overview
     * Dashboard overview with key metrics
     */
    readonly getVenueOverview = this.factory.createHandlers(
        validator('query', (value, c) => {
            const parsed = DateRangeSchema.safeParse(value);
            if (!parsed.success) {
                return c.json({ error: "Invalid query params", details: parsed.error.issues }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            try {
                const venueId = ctx.req.param("venueId");
                if (!venueId) {
                    return ctx.json({ error: "Venue ID required" }, 400);
                }

                // Verify ownership
                const isOwner = await this.verifyOwnership(ctx, venueId);
                if (!isOwner) {
                    return ctx.json({ error: "Forbidden: You are not the owner of this venue" }, 403);
                }

                const { start_date, end_date } = ctx.req.valid('query');

                // Get venue info
                const venue = await this.analyticsRepo.getVenueBasicInfo(venueId);
                if (!venue) {
                    return ctx.json({ error: "Venue not found" }, 404);
                }

                // Get analytics
                const overview = await this.analyticsRepo.getOverview(venueId, {
                    startDate: start_date,
                    endDate: end_date
                });

                return ctx.json({
                    venue: {
                        id: venue.id,
                        name: venue.name,
                        city: venue.city
                    },
                    period: {
                        startDate: start_date?.toISOString() ?? null,
                        endDate: end_date?.toISOString() ?? null
                    },
                    overview
                });
            } catch (error: any) {
                if (error.message === "Unauthorized") {
                    return ctx.json({ error: "Unauthorized" }, 401);
                }
                console.error("Analytics overview error:", error);
                return ctx.json({ error: "Failed to fetch analytics" }, 500);
            }
        }
    );

    /**
     * GET /venues/:venueId/analytics/reservations
     * Reservation trends over time
     */
    readonly getReservationAnalytics = this.factory.createHandlers(
        validator('query', (value, c) => {
            const parsed = TrendQuerySchema.safeParse(value);
            if (!parsed.success) {
                return c.json({ error: "Invalid query params", details: parsed.error.issues }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            try {
                const venueId = ctx.req.param("venueId");
                if (!venueId) {
                    return ctx.json({ error: "Venue ID required" }, 400);
                }

                // Verify ownership
                const isOwner = await this.verifyOwnership(ctx, venueId);
                if (!isOwner) {
                    return ctx.json({ error: "Forbidden: You are not the owner of this venue" }, 403);
                }

                const { start_date, end_date, group_by } = ctx.req.valid('query');

                // Get venue info
                const venue = await this.analyticsRepo.getVenueBasicInfo(venueId);
                if (!venue) {
                    return ctx.json({ error: "Venue not found" }, 404);
                }

                // Get trends
                const trends = await this.analyticsRepo.getReservationTrends(venueId, {
                    startDate: start_date,
                    endDate: end_date,
                    groupBy: group_by as GroupByPeriod
                });

                return ctx.json({
                    venue: {
                        id: venue.id,
                        name: venue.name
                    },
                    period: {
                        startDate: start_date?.toISOString() ?? null,
                        endDate: end_date?.toISOString() ?? null,
                        groupBy: group_by
                    },
                    trends
                });
            } catch (error: any) {
                if (error.message === "Unauthorized") {
                    return ctx.json({ error: "Unauthorized" }, 401);
                }
                console.error("Reservation analytics error:", error);
                return ctx.json({ error: "Failed to fetch reservation analytics" }, 500);
            }
        }
    );

    /**
     * GET /venues/:venueId/analytics/revenue
     * Revenue/occupancy trends (since reservations are free, we track capacity utilization)
     */
    readonly getRevenueAnalytics = this.factory.createHandlers(
        validator('query', (value, c) => {
            const parsed = TrendQuerySchema.safeParse(value);
            if (!parsed.success) {
                return c.json({ error: "Invalid query params", details: parsed.error.issues }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            try {
                const venueId = ctx.req.param("venueId");
                if (!venueId) {
                    return ctx.json({ error: "Venue ID required" }, 400);
                }

                // Verify ownership
                const isOwner = await this.verifyOwnership(ctx, venueId);
                if (!isOwner) {
                    return ctx.json({ error: "Forbidden: You are not the owner of this venue" }, 403);
                }

                const { start_date, end_date, group_by } = ctx.req.valid('query');

                // Get venue info
                const venue = await this.analyticsRepo.getVenueBasicInfo(venueId);
                if (!venue) {
                    return ctx.json({ error: "Venue not found" }, 404);
                }

                // Get trends
                const trends = await this.analyticsRepo.getRevenueTrends(venueId, {
                    startDate: start_date,
                    endDate: end_date,
                    groupBy: group_by as GroupByPeriod
                });

                return ctx.json({
                    venue: {
                        id: venue.id,
                        name: venue.name
                    },
                    period: {
                        startDate: start_date?.toISOString() ?? null,
                        endDate: end_date?.toISOString() ?? null,
                        groupBy: group_by
                    },
                    note: "Since reservations are free for users, this shows capacity utilization trends",
                    trends
                });
            } catch (error: any) {
                if (error.message === "Unauthorized") {
                    return ctx.json({ error: "Unauthorized" }, 401);
                }
                console.error("Revenue analytics error:", error);
                return ctx.json({ error: "Failed to fetch revenue analytics" }, 500);
            }
        }
    );
}

export default AnalyticsController;
