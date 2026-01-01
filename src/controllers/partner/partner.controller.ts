import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { PartnerRepository } from "../../repository/partner.repository";
import subscriptionsRepository from "../../repository/subscriptions.repository";

class PartnerController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly repository = new PartnerRepository();

    // GET /partners/venues
    readonly getMyVenues = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const venues = await this.repository.getVenuesByOwnerId(userId);
            return ctx.json({ venues });
        } catch (error: any) {
            console.error("Error fetching venues:", error);
            return ctx.json({ error: "Failed to fetch venues" }, 500);
        }
    });

    // POST /partners/venues
    readonly createVenue = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const body = await ctx.req.json();

            // Basic validation
            if (!body.name || !body.street_address || !body.city || !body.postal_code || !body.country) {
                return ctx.json({ error: "Missing required address fields" }, 400);
            }

            // Check if user already has a subscription, if not create a pending one
            let subscription = await subscriptionsRepository.getSubscriptionByUserId(userId);
            
            if (!subscription) {
                // Create a pending subscription for venue creation
                subscription = await subscriptionsRepository.createSubscription({
                    user_id: userId,
                    plan: 'basic',
                    status: 'trialing', // Will be activated after payment
                    current_period_start: new Date(),
                    current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day trial
                    stripe_subscription_id: `pending_${Date.now()}`,
                    stripe_payment_method_id: 'pending',
                    price: '0',
                });
            }

            const newVenue = await this.repository.createVenue({
                name: body.name,
                owner_id: userId,
                subscription_id: subscription.id,
                street_address: body.street_address,
                city: body.city,
                state_province: body.state_province,
                postal_code: body.postal_code,
                country: body.country,
                phone: body.phone,
                email: body.email,
                capacity: body.capacity,
            });

            return ctx.json({ venue: newVenue }, 201);
        } catch (error: any) {
            console.error("Error creating venue:", error);
            return ctx.json({ error: "Failed to create venue", details: error.message }, 500);
        }
    });

    // POST /partners/venues/:venueId/matches
    readonly scheduleMatch = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");

        try {
            const body = await ctx.req.json();
            const { match_id, total_capacity } = body;

            if (!venueId || !match_id || !total_capacity) {
                return ctx.json({ error: "venueId, match_id and total_capacity are required" }, 400);
            }

            const venueMatch = await this.repository.scheduleMatch(venueId, match_id, total_capacity);
            return ctx.json({ venueMatch }, 201);
        } catch (error: any) {
            console.error("Error scheduling match:", error);
            if (error.code === '23505') {
                return ctx.json({ error: "Match already scheduled at this venue" }, 409);
            }
            return ctx.json({ error: "Failed to schedule match", details: error.message }, 500);
        }
    });

    // DELETE /partners/venues/:venueId/matches/:matchId
    readonly cancelMatch = this.factory.createHandlers(async (ctx) => {
        const venueId = ctx.req.param("venueId");
        const matchId = ctx.req.param("matchId");

        try {
            if (!venueId || !matchId) {
                return ctx.json({ error: "venueId and matchId are required" }, 400);
            }

            await this.repository.cancelMatch(venueId, matchId);
            return ctx.json({ success: true });
        } catch (error: any) {
            console.error("Error canceling match:", error);
            return ctx.json({ error: "Failed to cancel match" }, 500);
        }
    });
    
    // GET /partners/venues/matches
    readonly getMyMatches = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user").id;
        
        try {
            const venueIds = await this.repository.getVenueIdsByOwnerId(userId);
            
            if (venueIds.length === 0) {
                return ctx.json({ data: [] });
            }

            const venueMatches = await this.repository.getVenueMatchesByVenueIds(venueIds);

            // Transform data to expected format
            const now = new Date();
            const data = venueMatches.map(vm => {
                const reservedSeats = vm.reservations?.reduce((sum, r) => sum + (r.party_size || r.quantity || 0), 0) || 0;
                const matchDate = vm.match?.scheduled_at ? new Date(vm.match.scheduled_at) : null;
                
                let status: 'upcoming' | 'live' | 'finished' = 'upcoming';
                if (vm.match?.status === 'finished') {
                    status = 'finished';
                } else if (vm.match?.status === 'live') {
                    status = 'live';
                } else if (matchDate && matchDate < now) {
                    status = 'finished';
                }

                return {
                    id: vm.id,
                    venue: vm.venue ? { id: vm.venue.id, name: vm.venue.name } : null,
                    match: vm.match ? {
                        id: vm.match.id,
                        homeTeam: vm.match.homeTeam?.name || 'TBD',
                        awayTeam: vm.match.awayTeam?.name || 'TBD',
                        scheduled_at: vm.match.scheduled_at,
                        league: vm.match.league?.name || null,
                    } : null,
                    total_capacity: vm.total_capacity,
                    reserved_seats: reservedSeats,
                    available_capacity: vm.available_capacity,
                    status,
                };
            });

            return ctx.json({ data });
        } catch (error: any) {
            console.error("Error fetching partner matches:", error);
            return ctx.json({ error: "Failed to fetch matches", details: error.message }, 500);
        }
    });

    // GET /partners/venues/:venueId/clients
    readonly getVenueClients = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user").id;
        const venueId = ctx.req.param("venueId");

        try {
            if (!venueId) {
                return ctx.json({ error: "Venue ID required" }, 400);
            }

            // Get clients data with ownership verification in a single transaction
            const { authorized, clients: reservations } = await this.repository.getVenueClientsData(venueId, userId);

            if (!authorized) {
                return ctx.json({ error: "Venue not found or access denied" }, 403);
            }

            // Transform to expected format
            const clients = reservations.map((r: any) => ({
                id: r.id,
                first_name: r.user?.first_name || '',
                last_name: r.user?.last_name || '',
                email: r.user?.email || '',
                match_name: r.venueMatch?.match 
                    ? `${r.venueMatch.match.homeTeam?.name || 'TBD'} vs ${r.venueMatch.match.awayTeam?.name || 'TBD'}`
                    : 'Unknown Match',
                reservation_date: r.created_at?.toISOString() || '',
                party_size: r.party_size || r.quantity || 1,
                status: r.status,
            }));

            return ctx.json({ clients, total: clients.length });
        } catch (error: any) {
            console.error("Error fetching venue clients:", error);
            return ctx.json({ error: "Failed to fetch clients", details: error.message }, 500);
        }
    });

    // GET /partners/stats/customers
    readonly getCustomerStats = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user").id;

        try {
            const venueIds = await this.repository.getVenueIdsByOwnerId(userId);
            
            if (venueIds.length === 0) {
                return ctx.json({
                    customerCount: 0,
                    totalGuests: 0,
                    totalReservations: 0,
                    period: "last_30_days"
                });
            }

            const stats = await this.repository.getCustomerCountLast30Days(venueIds);

            return ctx.json({
                ...stats,
                period: "last_30_days"
            });
        } catch (error: any) {
            console.error("Error fetching customer stats:", error);
            return ctx.json({ error: "Failed to fetch customer stats", details: error.message }, 500);
        }
    });

    // GET /partners/analytics/summary
    readonly getAnalyticsSummary = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user").id;

        try {
            const venueIds = await this.repository.getVenueIdsByOwnerId(userId);
            
            if (venueIds.length === 0) {
                return ctx.json({
                    total_clients: 0,
                    total_reservations: 0,
                    total_views: 0,
                    matches_completed: 0,
                    matches_upcoming: 0,
                    average_occupancy: 0,
                });
            }

            // Get all analytics data in a single transaction
            const { venueMatches, clientStats, matchStats } = await this.repository.getAnalyticsSummary(venueIds);

            // Calculate match counts
            const now = new Date();
            const matchesUpcoming = matchStats.filter(m => 
                m.status !== 'finished' && new Date(m.scheduledAt) > now
            ).length;
            const matchesCompleted = matchStats.filter(m => 
                m.status === 'finished' || new Date(m.scheduledAt) <= now
            ).length;

            // Calculate average occupancy
            const totalCapacity = venueMatches.reduce((sum, vm) => sum + (vm.total_capacity || 0), 0);
            const totalReserved = venueMatches.reduce((sum, vm) => sum + (vm.reserved_capacity || 0), 0);
            const averageOccupancy = totalCapacity > 0 
                ? Math.round((totalReserved / totalCapacity) * 100) 
                : 0;

            return ctx.json({
                total_clients: clientStats.uniqueUsers,
                total_reservations: clientStats.totalReservations,
                total_views: 0, // TODO: Implement view tracking
                matches_completed: matchesCompleted,
                matches_upcoming: matchesUpcoming,
                average_occupancy: averageOccupancy,
            });
        } catch (error: any) {
            console.error("Error fetching analytics summary:", error);
            return ctx.json({ error: "Failed to fetch analytics", details: error.message }, 500);
        }
    });
}

export default PartnerController;