import { createFactory } from "hono/factory";
import type { HonoEnv } from "../../types/hono.types";
import { PartnerRepository } from "../../repository/partner.repository";
import subscriptionsRepository from "../../repository/subscriptions.repository";
import stripe, { CHECKOUT_URLS, isStripeConfigured } from "../../config/stripe";

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
    // Creates a checkout session for venue creation - venue is only created after payment succeeds
    readonly createVenue = this.factory.createHandlers(async (ctx) => {
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

            // Store venue data in checkout session metadata (will be used to create venue after payment)
            const venueData = JSON.stringify({
                name: body.name,
                street_address: body.street_address,
                city: body.city,
                state_province: body.state_province || '',
                postal_code: body.postal_code,
                country: body.country,
                phone: body.phone || '',
                email: body.email || '',
                capacity: body.capacity || 0,
            });

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
                success_url: `${CHECKOUT_URLS.SUCCESS}&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: CHECKOUT_URLS.CANCEL,
                metadata: {
                    user_id: userId,
                    plan_id: planId,
                    venue_data: venueData, // Store venue data to create after payment
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

            // Retrieve the checkout session from Stripe
            const session = await stripe.checkout.sessions.retrieve(session_id, {
                expand: ['subscription']
            });

            console.log("Verifying checkout session:", session.id);
            console.log("Session status:", session.status);
            console.log("Payment status:", session.payment_status);

            // Verify the session belongs to this user
            if (session.metadata?.user_id !== userId) {
                return ctx.json({ error: "Session does not belong to this user" }, 403);
            }

            // Check if payment was successful
            if (session.payment_status !== 'paid') {
                return ctx.json({ error: "Payment not completed", status: session.payment_status }, 400);
            }

            // Check if this is a venue creation action
            if (session.metadata?.action !== 'create_venue') {
                return ctx.json({ error: "Invalid session type" }, 400);
            }

            // Check if venue was already created (idempotency)
            const existingVenues = await this.repository.getVenuesByOwnerId(userId);
            const venueData = JSON.parse(session.metadata.venue_data || '{}');
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
}

export default PartnerController;