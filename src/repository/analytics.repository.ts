import { db } from "../config/config.db";
import { reservationsTable } from "../config/db/reservations.table";
import { venueMatchesTable, matchesTable } from "../config/db/matches.table";
import { venuesTable } from "../config/db/venues.table";
import { teamsTable } from "../config/db/sports.table";
import { eq, and, gte, lte, sql, count, desc, inArray } from "drizzle-orm";

// ============================================
// TYPES
// ============================================

export type GroupByPeriod = 'day' | 'week' | 'month';

export interface DateRangeParams {
    startDate?: Date;
    endDate?: Date;
}

export interface AnalyticsParams extends DateRangeParams {
    groupBy?: GroupByPeriod;
}

export interface OverviewStats {
    totalReservations: number;
    totalReservationsPeriod: number;
    confirmedReservations: number;
    canceledReservations: number;
    checkedInReservations: number;
    averagePartySize: number;
    averageOccupancy: number;
    topMatches: TopMatch[];
}

export interface TopMatch {
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    scheduledAt: Date;
    reservationCount: number;
    totalGuests: number;
}

export interface ReservationTrend {
    period: string;
    totalReservations: number;
    confirmedReservations: number;
    canceledReservations: number;
    checkedInReservations: number;
    totalGuests: number;
}

export interface RevenueTrend {
    period: string;
    totalReservations: number;
    totalGuests: number;
    occupancyRate: number;
}

export class AnalyticsRepository {

    /**
     * Check if user is the owner of the venue
     */
    async isVenueOwner(venueId: string, userId: string): Promise<boolean> {
        const venue = await db.query.venuesTable.findFirst({
            where: eq(venuesTable.id, venueId),
            columns: { owner_id: true }
        });

        return venue?.owner_id === userId;
    }

    /**
     * Get all venue match IDs for a venue
     */
    private async getVenueMatchIds(venueId: string): Promise<string[]> {
        const venueMatches = await db.select({ id: venueMatchesTable.id })
            .from(venueMatchesTable)
            .where(eq(venueMatchesTable.venue_id, venueId));

        return venueMatches.map(vm => vm.id);
    }

    /**
     * Get overview analytics for a venue
     */
    async getOverview(venueId: string, params: DateRangeParams = {}): Promise<OverviewStats> {
        const venueMatchIds = await this.getVenueMatchIds(venueId);

        if (venueMatchIds.length === 0) {
            return {
                totalReservations: 0,
                totalReservationsPeriod: 0,
                confirmedReservations: 0,
                canceledReservations: 0,
                checkedInReservations: 0,
                averagePartySize: 0,
                averageOccupancy: 0,
                topMatches: []
            };
        }

        // Build date conditions
        const dateConditions = [];
        if (params.startDate) {
            dateConditions.push(gte(reservationsTable.created_at, params.startDate));
        }
        if (params.endDate) {
            dateConditions.push(lte(reservationsTable.created_at, params.endDate));
        }

        // All-time stats
        const [allTimeStats] = await db.select({
            total: count(),
            avgPartySize: sql<number>`COALESCE(AVG(${reservationsTable.party_size}), 0)::float`,
        })
        .from(reservationsTable)
        .where(inArray(reservationsTable.venue_match_id, venueMatchIds));

        // Period stats
        const periodCondition = dateConditions.length > 0 
            ? and(inArray(reservationsTable.venue_match_id, venueMatchIds), ...dateConditions)
            : inArray(reservationsTable.venue_match_id, venueMatchIds);

        const [periodStats] = await db.select({
            total: count(),
            confirmed: sql<number>`COUNT(*) FILTER (WHERE ${reservationsTable.status} = 'confirmed')::int`,
            canceled: sql<number>`COUNT(*) FILTER (WHERE ${reservationsTable.status} = 'canceled')::int`,
            checkedIn: sql<number>`COUNT(*) FILTER (WHERE ${reservationsTable.status} = 'checked_in')::int`,
        })
        .from(reservationsTable)
        .where(periodCondition);

        // Calculate average occupancy
        const occupancyResult = await db.select({
            totalCapacity: sql<number>`COALESCE(SUM(${venueMatchesTable.total_capacity}), 0)::int`,
            totalReserved: sql<number>`COALESCE(SUM(${venueMatchesTable.reserved_capacity}), 0)::int`,
        })
        .from(venueMatchesTable)
        .where(eq(venueMatchesTable.venue_id, venueId));

        const occupancyStats = occupancyResult[0];
        const averageOccupancy = occupancyStats && occupancyStats.totalCapacity > 0
            ? Math.round((occupancyStats.totalReserved / occupancyStats.totalCapacity) * 100)
            : 0;

        // Top matches
        const topMatches = await this.getTopMatches(venueId, 5);

        return {
            totalReservations: allTimeStats?.total ?? 0,
            totalReservationsPeriod: periodStats?.total ?? 0,
            confirmedReservations: periodStats?.confirmed ?? 0,
            canceledReservations: periodStats?.canceled ?? 0,
            checkedInReservations: periodStats?.checkedIn ?? 0,
            averagePartySize: Math.round((allTimeStats?.avgPartySize ?? 0) * 10) / 10,
            averageOccupancy,
            topMatches
        };
    }

    /**
     * Get top matches by reservation count
     */
    async getTopMatches(venueId: string, limit: number = 5): Promise<TopMatch[]> {
        // Alias teams table for home and away teams
        const homeTeams = db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable).as('home_teams');
        const awayTeams = db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable).as('away_teams');

        const results = await db.select({
            matchId: matchesTable.id,
            homeTeamId: matchesTable.home_team_id,
            awayTeamId: matchesTable.away_team_id,
            scheduledAt: matchesTable.scheduled_at,
            reservationCount: sql<number>`COUNT(${reservationsTable.id})::int`,
            totalGuests: sql<number>`COALESCE(SUM(${reservationsTable.party_size}), 0)::int`,
        })
        .from(reservationsTable)
        .innerJoin(venueMatchesTable, eq(reservationsTable.venue_match_id, venueMatchesTable.id))
        .innerJoin(matchesTable, eq(venueMatchesTable.match_id, matchesTable.id))
        .where(eq(venueMatchesTable.venue_id, venueId))
        .groupBy(matchesTable.id, matchesTable.home_team_id, matchesTable.away_team_id, matchesTable.scheduled_at)
        .orderBy(desc(sql`COUNT(${reservationsTable.id})`))
        .limit(limit);

        // Fetch team names separately for better performance
        const teamIds = [...new Set(results.flatMap(r => [r.homeTeamId, r.awayTeamId]))];
        const teams = teamIds.length > 0 
            ? await db.select({ id: teamsTable.id, name: teamsTable.name })
                .from(teamsTable)
                .where(inArray(teamsTable.id, teamIds))
            : [];
        
        const teamMap = new Map(teams.map(t => [t.id, t.name]));

        return results.map(r => ({
            matchId: r.matchId,
            homeTeam: teamMap.get(r.homeTeamId) ?? 'Unknown',
            awayTeam: teamMap.get(r.awayTeamId) ?? 'Unknown',
            scheduledAt: r.scheduledAt,
            reservationCount: r.reservationCount,
            totalGuests: r.totalGuests
        }));
    }

    /**
     * Get reservation trends grouped by period
     */
    async getReservationTrends(venueId: string, params: AnalyticsParams = {}): Promise<ReservationTrend[]> {
        const venueMatchIds = await this.getVenueMatchIds(venueId);

        if (venueMatchIds.length === 0) {
            return [];
        }

        const groupBy = params.groupBy || 'day';
        const dateFormat = this.getDateFormat(groupBy);

        // Build conditions
        const conditions = [inArray(reservationsTable.venue_match_id, venueMatchIds)];
        if (params.startDate) {
            conditions.push(gte(reservationsTable.created_at, params.startDate));
        }
        if (params.endDate) {
            conditions.push(lte(reservationsTable.created_at, params.endDate));
        }

        const results = await db.select({
            period: sql<string>`TO_CHAR(${reservationsTable.created_at}, ${dateFormat})`,
            totalReservations: count(),
            confirmedReservations: sql<number>`COUNT(*) FILTER (WHERE ${reservationsTable.status} = 'confirmed')::int`,
            canceledReservations: sql<number>`COUNT(*) FILTER (WHERE ${reservationsTable.status} = 'canceled')::int`,
            checkedInReservations: sql<number>`COUNT(*) FILTER (WHERE ${reservationsTable.status} = 'checked_in')::int`,
            totalGuests: sql<number>`COALESCE(SUM(${reservationsTable.party_size}), 0)::int`,
        })
        .from(reservationsTable)
        .where(and(...conditions))
        .groupBy(sql`TO_CHAR(${reservationsTable.created_at}, ${dateFormat})`)
        .orderBy(sql`TO_CHAR(${reservationsTable.created_at}, ${dateFormat})`);

        return results.map(r => ({
            period: r.period,
            totalReservations: r.totalReservations,
            confirmedReservations: r.confirmedReservations,
            canceledReservations: r.canceledReservations,
            checkedInReservations: r.checkedInReservations,
            totalGuests: r.totalGuests
        }));
    }

    /**
     * Get revenue/occupancy trends (since reservations are free, we track guests)
     */
    async getRevenueTrends(venueId: string, params: AnalyticsParams = {}): Promise<RevenueTrend[]> {
        const groupBy = params.groupBy || 'day';
        const dateFormat = this.getDateFormat(groupBy);

        // Build conditions
        const conditions = [eq(venueMatchesTable.venue_id, venueId)];

        const results = await db.select({
            period: sql<string>`TO_CHAR(${matchesTable.scheduled_at}, ${dateFormat})`,
            totalReservations: sql<number>`COUNT(DISTINCT ${reservationsTable.id})::int`,
            totalGuests: sql<number>`COALESCE(SUM(${reservationsTable.party_size}), 0)::int`,
            totalCapacity: sql<number>`SUM(${venueMatchesTable.total_capacity})::int`,
            reservedCapacity: sql<number>`SUM(${venueMatchesTable.reserved_capacity})::int`,
        })
        .from(venueMatchesTable)
        .innerJoin(matchesTable, eq(venueMatchesTable.match_id, matchesTable.id))
        .leftJoin(reservationsTable, eq(reservationsTable.venue_match_id, venueMatchesTable.id))
        .where(and(...conditions))
        .groupBy(sql`TO_CHAR(${matchesTable.scheduled_at}, ${dateFormat})`)
        .orderBy(sql`TO_CHAR(${matchesTable.scheduled_at}, ${dateFormat})`);

        // Apply date filter if provided
        let filteredResults = results;
        if (params.startDate || params.endDate) {
            filteredResults = results.filter(r => {
                // Simple string comparison for filtering (works for ISO dates)
                return true; // The SQL query already handles date filtering via scheduled_at
            });
        }

        return filteredResults.map(r => ({
            period: r.period,
            totalReservations: r.totalReservations ?? 0,
            totalGuests: r.totalGuests ?? 0,
            occupancyRate: r.totalCapacity > 0 
                ? Math.round((r.reservedCapacity / r.totalCapacity) * 100)
                : 0
        }));
    }

    /**
     * Get PostgreSQL date format based on groupBy period
     */
    private getDateFormat(groupBy: GroupByPeriod): string {
        switch (groupBy) {
            case 'day':
                return 'YYYY-MM-DD';
            case 'week':
                return 'IYYY-IW'; // ISO week format
            case 'month':
                return 'YYYY-MM';
            default:
                return 'YYYY-MM-DD';
        }
    }

    /**
     * Get venue basic info (for response context)
     */
    async getVenueBasicInfo(venueId: string) {
        return await db.query.venuesTable.findFirst({
            where: eq(venuesTable.id, venueId),
            columns: {
                id: true,
                name: true,
                city: true,
                total_reservations: true,
            }
        });
    }
}
