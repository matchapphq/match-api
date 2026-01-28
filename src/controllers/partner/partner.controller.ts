import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { z } from "zod";
import type { HonoEnv } from "../../types/hono.types";
import { PartnerRepository } from "../../repository/partner.repository";
import { WaitlistRepository } from "../../repository/waitlist.repository";
import subscriptionsRepository from "../../repository/subscriptions.repository";
import stripe, { CHECKOUT_URLS, isStripeConfigured } from "../../config/stripe";
import { geocodeAddress } from "../../utils/geocoding";

class PartnerController {
    private readonly factory = createFactory<HonoEnv>();
    private readonly repository = new PartnerRepository();
    private readonly waitlistRepo = new WaitlistRepository();

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
    // Creates a checkout session for venue creation - venue is only created after payment succeeds
    public readonly createVenue = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const body = await ctx.req.json();

            // Basic validation
            if (!body.name || !body.street_address || !body.city || !body.postal_code || !body.country) {
                return ctx.json({ error: "Missing required address fields" }, 400);
            }            
            
            // Check if Stripe is configured
            if (!isStripeConfigured()) {
                return ctx.json({ error: "Payment system not configured" }, 503);
            }

            // Get plan from body or default to monthly
            const planId = body.plan_id || 'monthly';
            const plan = planId === 'annual' 
                ? { price: 300, currency: 'eur', interval: 'year' as const, name: 'Annuel' }
                : { price: 30, currency: 'eur', interval: 'month' as const, name: 'Mensuel' };

            // Get or create Stripe customer
            let stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);

            if (!stripeCustomerId) {
                // Get user email from users table
                const userResult = await subscriptionsRepository.getUserById(userId);
                if (!userResult) {
                    return ctx.json({ error: "User not found" }, 404);
                }

                const customer = await stripe.customers.create({
                    email: userResult.email,
                    metadata: { user_id: userId },
                });

                stripeCustomerId = customer.id;
                await subscriptionsRepository.setStripeCustomerId(userId, stripeCustomerId);
            }

            // Store venue data in checkout session metadata
            const venueData = {
                name: body.name,
                street_address: body.street_address,
                city: body.city,
                state_province: body.state_province || '',
                postal_code: body.postal_code,
                country: body.country,
                phone: body.phone || '',
                email: body.email || '',
                capacity: body.capacity || 0,
            };
            const venueDataStr = JSON.stringify(venueData);

            console.log(`[Create Venue] Creating session for user ${userId}. Data length: ${venueDataStr.length}`);
            if (venueDataStr.length > 500) {
                console.warn("[Create Venue] Warning: venue_data metadata exceeds 500 chars, might be truncated by Stripe");
            }

            // Use provided redirect URLs or fallback to config
            const successUrl = body.success_url 
                ? `${body.success_url}?checkout=success&session_id={CHECKOUT_SESSION_ID}` 
                : `${CHECKOUT_URLS.SUCCESS}&session_id={CHECKOUT_SESSION_ID}`;
            
            const cancelUrl = body.cancel_url || CHECKOUT_URLS.CANCEL;

            // Create Checkout Session
            const session = await stripe.checkout.sessions.create({
                customer: stripeCustomerId,
                payment_method_types: ['card', 'sepa_debit'],
                mode: 'subscription',
                line_items: [{
                    price_data: {
                        currency: plan.currency,
                        product_data: {
                            name: `Match - Abonnement ${plan.name}`,
                            description: `Abonnement pour ${body.name}`,
                        },
                        unit_amount: plan.price * 100,
                        recurring: {
                            interval: plan.interval,
                        },
                    },
                    quantity: 1,
                }],
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    user_id: userId,
                    plan_id: planId,
                    venue_data: venueDataStr,
                    action: 'create_venue',
                },
                subscription_data: {
                    metadata: {
                        user_id: userId,
                        plan_id: planId,
                    },
                },
                allow_promotion_codes: true,
            });

            console.log(`[Create Venue] Session created: ${session.id}. Success URL: ${successUrl}`);

            return ctx.json({ 
                checkout_url: session.url,
                session_id: session.id,
                message: 'Please complete payment to create your venue'
            });
        } catch (error: any) {
            console.error("Error creating venue checkout:", error);
            return ctx.json({ error: "Failed to create checkout session", details: error.message }, 500);
        }
    });

    // POST /partners/venues/verify-checkout
    // Verifies checkout session and creates venue after successful payment
    readonly verifyCheckoutAndCreateVenue = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const body = await ctx.req.json();
            const { session_id } = body;

            if (!session_id) {
                return ctx.json({ error: "session_id is required" }, 400);
            }

            console.log(`[Verify Checkout] Verifying session ${session_id} for user ${userId}`);

            // Retrieve the checkout session from Stripe
            const session = await stripe.checkout.sessions.retrieve(session_id, {
                expand: ['subscription']
            });

            console.log(`[Verify Checkout] Session status: ${session.status}, Payment status: ${session.payment_status}`);
            console.log(`[Verify Checkout] Metadata:`, session.metadata);

            // Verify the session belongs to this user
            if (session.metadata?.user_id !== userId) {
                console.error(`[Verify Checkout] User mismatch. Session user: ${session.metadata?.user_id}, Current user: ${userId}`);
                return ctx.json({ error: "Session does not belong to this user" }, 403);
            }

            // Check if payment was successful
            if (session.payment_status !== 'paid') {
                return ctx.json({ error: "Payment not completed", status: session.payment_status }, 400);
            }

            // Check if this is a venue creation action
            if (session.metadata?.action !== 'create_venue') {
                console.error(`[Verify Checkout] Action mismatch. Action: ${session.metadata?.action}`);
                return ctx.json({ error: "Invalid session type or missing venue data" }, 400);
            }

            const venueDataStr = session.metadata.venue_data;
            if (!venueDataStr) {
                console.error(`[Verify Checkout] Missing venue_data in metadata`);
                return ctx.json({ error: "Missing venue data" }, 400);
            }

            // Check if venue was already created (idempotency)
            const existingVenues = await this.repository.getVenuesByOwnerId(userId);
            const venueData = JSON.parse(venueDataStr || '{}');
            const alreadyExists = existingVenues.some(v => 
                v.name === venueData.name && 
                v.street_address === venueData.street_address
            );

            if (alreadyExists) {
                const existingVenue = existingVenues.find(v => 
                    v.name === venueData.name && 
                    v.street_address === venueData.street_address
                );
                return ctx.json({ 
                    venue: existingVenue, 
                    message: "Venue already created",
                    already_exists: true 
                });
            }

            // Get subscription details
            const stripeSubscription = session.subscription as any;
            const planId = session.metadata.plan_id || 'monthly';
            // Map plan_id to database plan enum: monthly -> basic, annual -> pro
            const plan = planId === 'annual' ? 'pro' : 'basic';

            // Calculate commitment end date
            const commitmentEndDate = new Date();
            commitmentEndDate.setFullYear(commitmentEndDate.getFullYear() + 1);

            // Create subscription in our database
            const newSubscription = await subscriptionsRepository.createSubscription({
                user_id: userId,
                plan: plan,
                status: "active",
                current_period_start: new Date(
                    (stripeSubscription?.current_period_start || Date.now() / 1000) * 1000
                ),
                current_period_end: new Date(
                    (stripeSubscription?.current_period_end || Date.now() / 1000) * 1000
                ),
                stripe_subscription_id: stripeSubscription?.id || session.subscription as string,
                stripe_payment_method_id: stripeSubscription?.default_payment_method as string || "unknown",
                price: planId === 'annual' ? '300' : '30',
                auto_renew: true,
                commitment_end_date: commitmentEndDate,
            });

            console.log("Subscription created:", newSubscription.id);

            // Create the venue
            const newVenue = await this.repository.createVenue({
                name: venueData.name,
                owner_id: userId,
                subscription_id: newSubscription.id,
                street_address: venueData.street_address,
                city: venueData.city,
                state_province: venueData.state_province || '',
                postal_code: venueData.postal_code,
                country: venueData.country,
                phone: venueData.phone || '',
                email: venueData.email || '',
                capacity: venueData.capacity || 0,
            });

            console.log("Venue created:", newVenue?.id);

            return ctx.json({ 
                venue: newVenue, 
                subscription: newSubscription,
                message: "Venue created successfully" 
            });
        } catch (error: any) {
            console.error("Error verifying checkout:", error);
            return ctx.json({ error: "Failed to verify checkout", details: error.message }, 500);
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
    public readonly getAnalyticsSummary = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user").id;

        try {
            const period = parseInt(ctx.req.query('period') || '30', 10);
            const venueIds = await this.repository.getVenueIdsByOwnerId(userId);
            
            if (venueIds.length === 0) {
                return ctx.json({
                    total_clients: 0,
                    total_reservations: 0,
                    total_views: 0,
                    matches_completed: 0,
                    matches_upcoming: 0,
                    average_occupancy: 0,
                    trends: {
                        clients: 0,
                        reservations: 0,
                        matches: 0,
                        views: 0
                    }
                });
            }

            // Get all analytics data with trends
            const { venueMatches, clientStats, matchStats, totalViews, trends } = await this.repository.getAnalyticsSummary(venueIds, period);

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
                total_views: totalViews,
                matches_completed: matchesCompleted,
                matches_upcoming: matchesUpcoming,
                average_occupancy: averageOccupancy,
                trends,
            });
        } catch (error: any) {
            console.error("Error fetching analytics summary:", error);
            return ctx.json({ error: "Failed to fetch analytics", details: error.message }, 500);
        }
    });

    // GET /partners/activity
    readonly getRecentActivity = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        
        try {
            const limit = parseInt(ctx.req.query('limit') || '20', 10);
            const activity = await this.repository.getRecentActivity(userId, limit);
            return ctx.json({ activity });
        } catch (error: any) {
            console.error("Error fetching recent activity:", error);
            return ctx.json({ error: "Failed to fetch recent activity", details: error.message }, 500);
        }
    });

    // GET /partners/venues/:venueId/subscription
    // Get subscription for a specific venue
    readonly getVenueSubscription = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');

        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        try {
            // Verify venue ownership
            const venue = await this.repository.getVenueByIdAndOwner(venueId, userId);
            if (!venue) {
                return ctx.json({ error: "Venue not found or access denied" }, 404);
            }

            // Get subscription by venue's subscription_id
            if (!venue.subscription_id) {
                return ctx.json({ subscription: null });
            }

            const subscription = await subscriptionsRepository.getSubscriptionById(venue.subscription_id);
            
            if (!subscription) {
                return ctx.json({ subscription: null });
            }

            // Map plan to user-friendly name and get actual price
            const planInfo = {
                basic: { name: 'Mensuel', displayPrice: '30€/mois' },
                pro: { name: 'Annuel', displayPrice: '300€/an' },
                enterprise: { name: 'Enterprise', displayPrice: 'Sur devis' },
                trial: { name: 'Essai', displayPrice: 'Gratuit' },
            };

            const info = planInfo[subscription.plan as keyof typeof planInfo] || { name: subscription.plan, displayPrice: `${subscription.price}€` };

            return ctx.json({ 
                subscription: {
                    ...subscription,
                    plan_name: info.name,
                    display_price: info.displayPrice,
                }
            });
        } catch (error: any) {
            console.error("Error fetching venue subscription:", error);
            return ctx.json({ error: "Failed to fetch subscription", details: error.message }, 500);
        }
    });

    // POST /partners/venues/:venueId/payment-portal
    // Opens Stripe Customer Portal for a specific venue's payment method
    readonly getVenuePaymentPortal = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');

        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        if (!isStripeConfigured()) {
            return ctx.json({ error: "Payment system not configured" }, 503);
        }

        try {
            // Verify venue ownership
            const venue = await this.repository.getVenueByIdAndOwner(venueId, userId);
            if (!venue) {
                return ctx.json({ error: "Venue not found or access denied" }, 404);
            }

            // Get user's Stripe customer ID
            const stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);
            if (!stripeCustomerId) {
                return ctx.json({ error: "No payment profile found" }, 404);
            }

            // Create Stripe Customer Portal session
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: stripeCustomerId,
                return_url: CHECKOUT_URLS.SUCCESS.replace('?checkout=success', ''),
            });

            return ctx.json({ portal_url: portalSession.url });
        } catch (error: any) {
            console.error("Error creating payment portal:", error);
            return ctx.json({ error: "Failed to create payment portal", details: error.message }, 500);
        }
    });

    // PATCH /partners/reservations/:reservationId/status
    // Update reservation status (confirm or decline PENDING reservations)
    readonly updateReservationStatus = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const reservationId = ctx.req.param('reservationId');

        if (!reservationId) {
            return ctx.json({ error: "Reservation ID required" }, 400);
        }

        try {
            const body = await ctx.req.json();
            const { status } = body;

            if (!status || !['CONFIRMED', 'DECLINED'].includes(status)) {
                return ctx.json({ error: "Status must be 'CONFIRMED' or 'DECLINED'" }, 400);
            }

            // Update reservation status with ownership verification
            const result = await this.repository.updateReservationStatus(
                reservationId,
                userId,
                status
            );

            if (!result.success) {
                const statusCode = (result.statusCode || 400) as 400 | 403 | 404;
                return ctx.json({ error: result.error }, statusCode);
            }

            return ctx.json({ reservation: result.reservation });
        } catch (error: any) {
            console.error("Error updating reservation status:", error);
            return ctx.json({ error: "Failed to update reservation status", details: error.message }, 500);
        }
    });

    // GET /partners/venues/:venueId/reservations
    // Get all reservations for a specific venue
    readonly getVenueReservations = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');

        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        try {
            const page = parseInt(ctx.req.query('page') || '1', 10);
            const limit = parseInt(ctx.req.query('limit') || '20', 10);
            const status = ctx.req.query('status') || 'all';

            const result = await this.repository.getVenueReservations(venueId, userId, { page, limit, status });

            if (!result.authorized) {
                return ctx.json({ error: "Venue not found or access denied" }, 403);
            }

            return ctx.json({
                reservations: result.reservations,
                total: result.total,
                page: result.page,
                limit: result.limit,
            });
        } catch (error: any) {
            console.error("Error getting venue reservations:", error);
            return ctx.json({ error: "Failed to get venue reservations", details: error.message }, 500);
        }
    });

    // PUT /partners/venues/:venueId/matches/:matchId
    // Update a venue match
    readonly updateVenueMatch = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');
        const matchId = ctx.req.param('matchId');

        if (!venueId || !matchId) {
            return ctx.json({ error: "Venue ID and Match ID required" }, 400);
        }

        try {
            const body = await ctx.req.json();

            const result = await this.repository.updateVenueMatch(venueId, matchId, userId, {
                total_capacity: body.total_capacity,
                available_capacity: body.available_capacity,
                is_active: body.is_active,
                is_featured: body.is_featured,
                allows_reservations: body.allows_reservations,
                max_group_size: body.max_group_size,
                notes: body.notes,
            });

            if (!result.success) {
                const statusCode = (result.statusCode || 400) as 400 | 403 | 404;
                return ctx.json({ error: result.error }, statusCode);
            }

            return ctx.json({ venueMatch: result.venueMatch });
        } catch (error: any) {
            console.error("Error updating venue match:", error);
            return ctx.json({ error: "Failed to update venue match", details: error.message }, 500);
        }
    });

    // GET /partners/analytics/dashboard
    // Get complete analytics dashboard
    readonly getAnalyticsDashboard = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const startDate = ctx.req.query('start_date');
            const endDate = ctx.req.query('end_date');

            const dateRange = startDate ? {
                start: new Date(startDate),
                end: endDate ? new Date(endDate) : undefined,
            } : undefined;

            const dashboard = await this.repository.getAnalyticsDashboard(userId, dateRange);
            return ctx.json(dashboard);
        } catch (error: any) {
            console.error("Error getting analytics dashboard:", error);
            return ctx.json({ error: "Failed to get analytics dashboard", details: error.message }, 500);
        }
    });

    // Get matches calendar view
    readonly getMatchesCalendar = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');

        if (!venueId) {
            return ctx.json({ error: "Venue ID is required" }, 400);
        }

        try {
            const month = ctx.req.query('month');
            const status = ctx.req.query('status');

            const result = await this.repository.getMatchesCalendar(venueId, userId, { month, status });

            if (!result.success) {
                const status = result.statusCode === 403 ? 403 : result.statusCode === 404 ? 404 : 500;
                return ctx.json({ error: result.error }, status);
            }

            return ctx.json({
                matches: result.matches,
                summary: result.summary,
                days_with_matches: result.days_with_matches,
            });
        } catch (error: any) {
            console.error("Error getting matches calendar:", error);
            return ctx.json({ error: "Failed to get matches calendar", details: error.message }, 500);
        }
    });

    // Get reservation statistics
    readonly getReservationStats = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');

        if (!venueId) {
            return ctx.json({ error: "Venue ID is required" }, 400);
        }

        try {
            const from = ctx.req.query('from');
            const to = ctx.req.query('to');

            const dateRange = from ? {
                from: new Date(from),
                to: to ? new Date(to) : undefined,
            } : undefined;

            const result = await this.repository.getReservationStats(venueId, userId, dateRange);

            if (!result.success) {
                const status = result.statusCode === 403 ? 403 : result.statusCode === 404 ? 404 : 500;
                return ctx.json({ error: result.error }, status);
            }

            return ctx.json({ stats: result.stats });
        } catch (error: any) {
            console.error("Error getting reservation stats:", error);
            return ctx.json({ error: "Failed to get reservation stats", details: error.message }, 500);
        }
    });

    // Update reservation (full update)
    readonly updateReservationFull = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const schema = z.object({
                status: z.enum(['pending', 'confirmed', 'canceled', 'checked_in', 'completed', 'no_show']).optional(),
                table_number: z.string().optional(),
                notes: z.string().optional(),
                party_size: z.number().int().positive().optional(),
                special_requests: z.string().optional(),
            });
            const parsed = schema.safeParse(value);
            if (!parsed.success) {
                return ctx.json({ error: "Invalid request body", details: parsed.error }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            const userId = ctx.get('user').id;
            const reservationId = ctx.req.param('reservationId');

            if (!reservationId) {
                return ctx.json({ error: "Reservation ID is required" }, 400);
            }

            try {
                const data = ctx.req.valid('json');
                const result = await this.repository.updateReservation(reservationId, userId, data);

                if (!result.success) {
                    const response: any = { error: result.error };
                    if ('available_seats' in result) {
                        response.available_seats = result.available_seats;
                        response.requested_increase = result.requested_increase;
                    }
                    const status = result.statusCode === 403 ? 403 : result.statusCode === 404 ? 404 : result.statusCode === 400 ? 400 : 500;
                    return ctx.json(response, status);
                }

                return ctx.json({ reservation: result.reservation });
            } catch (error: any) {
                console.error("Error updating reservation:", error);
                return ctx.json({ error: "Failed to update reservation", details: error.message }, 500);
            }
        }
    );

    // Mark reservation as no-show
    readonly markReservationNoShow = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const schema = z.object({
                reason: z.string().optional(),
            });
            const parsed = schema.safeParse(value);
            if (!parsed.success) {
                return ctx.json({ error: "Invalid request body", details: parsed.error }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            const userId = ctx.get('user').id;
            const reservationId = ctx.req.param('reservationId');

            if (!reservationId) {
                return ctx.json({ error: "Reservation ID is required" }, 400);
            }

            try {
                const { reason } = ctx.req.valid('json');
                const result = await this.repository.markReservationNoShow(reservationId, userId, reason);

                if (!result.success) {
                    const response: any = { error: result.error };
                    if ('current_status' in result) {
                        response.current_status = result.current_status;
                    }
                    const status = result.statusCode === 403 ? 403 : result.statusCode === 404 ? 404 : result.statusCode === 400 ? 400 : 500;
                    return ctx.json(response, status);
                }

                return ctx.json({
                    reservation: result.reservation,
                    seats_released: result.seats_released,
                });
            } catch (error: any) {
                console.error("Error marking reservation as no-show:", error);
                return ctx.json({ error: "Failed to mark reservation as no-show", details: error.message }, 500);
            }
        }
    );

    // =============================================
    // WAITLIST MANAGEMENT (Partner)
    // =============================================

    // View waitlist for a venue match
    readonly getVenueMatchWaitlist = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');
        const matchId = ctx.req.param('matchId');

        if (!venueId || !matchId) {
            return ctx.json({ error: "Venue ID and Match ID required" }, 400);
        }

        try {
            // Verify venue ownership
            const venues = await this.repository.getVenuesByOwnerId(userId);
            const ownsVenue = venues.some(v => v.id === venueId);
            if (!ownsVenue) {
                return ctx.json({ error: "Not authorized to view this venue's waitlist" }, 403);
            }

            // TODO: Get venue_match_id from venueId and matchId
            const venueMatchId = matchId;

            const status = ctx.req.query('status');
            const entries = await this.waitlistRepo.getWaitlistForVenueMatch(venueMatchId, status);
            const totalWaitingSize = await this.waitlistRepo.getTotalWaitingPartySize(venueMatchId);

            return ctx.json({
                waitlist: entries,
                summary: {
                    total_entries: entries.length,
                    waiting_entries: entries.filter(e => e.status === 'waiting').length,
                    notified_entries: entries.filter(e => e.status === 'notified').length,
                    total_party_size: totalWaitingSize,
                },
            });
        } catch (error: any) {
            console.error("Error getting waitlist:", error);
            return ctx.json({ error: "Failed to get waitlist", details: error.message }, 500);
        }
    });

    // Notify a waitlist customer that a spot is available
    readonly notifyWaitlistCustomer = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const schema = z.object({
                message: z.string().optional(),
                expiry_minutes: z.number().int().positive().default(60),
            });
            const parsed = schema.safeParse(value);
            if (!parsed.success) {
                return ctx.json({ error: "Invalid request body", details: parsed.error }, 400);
            }
            return parsed.data;
        }),
        async (ctx) => {
            const userId = ctx.get('user').id;
            const entryId = ctx.req.param('entryId');

            if (!entryId) {
                return ctx.json({ error: "Entry ID required" }, 400);
            }

            try {
                const { expiry_minutes } = ctx.req.valid('json');
                const result = await this.waitlistRepo.notifyUserManually(entryId, expiry_minutes);

                if (!result.success) {
                    return ctx.json({ error: result.error }, 400);
                }

                return ctx.json({
                    waitlistEntry: result.waitlistEntry,
                    notifications_sent: result.notifications_sent,
                    message: "Customer has been notified and has " + expiry_minutes + " minutes to claim their spot.",
                });
            } catch (error: any) {
                console.error("Error notifying waitlist customer:", error);
                return ctx.json({ error: "Failed to notify customer", details: error.message }, 500);
            }
        }
    );

}

export default PartnerController;