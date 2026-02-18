import { PartnerRepository } from "../../repository/partner/partner.repository";
import { WaitlistRepository } from "../../repository/waitlist.repository";
import subscriptionsRepository from "../../repository/subscriptions.repository";
import stripe, { CHECKOUT_URLS, isStripeConfigured } from "../../config/stripe";
import { geocodeAddress } from "../../utils/geocoding";
import { notifyNewReservation, notifyReservationCancelled } from "../../services/notifications/notification.triggers";

export class PartnerLogic {
    constructor(
        private readonly partnerRepo: PartnerRepository,
        private readonly waitlistRepo: WaitlistRepository
    ) {}

    async getMyVenues(userId: string) {
        return await this.partnerRepo.getVenuesByOwnerId(userId);
    }

    async createVenueCheckout(userId: string, data: any) {
        if (!isStripeConfigured()) {
            throw new Error("PAYMENT_SYSTEM_NOT_CONFIGURED");
        }

        const planId = data.plan_id || 'monthly';
        const plan = planId === 'annual' 
            ? { price: 300, currency: 'eur', interval: 'year' as const, name: 'Annuel' }
            : { price: 30, currency: 'eur', interval: 'month' as const, name: 'Mensuel' };

        let stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);

        if (!stripeCustomerId) {
            const userResult = await subscriptionsRepository.getUserById(userId);
            if (!userResult) throw new Error("USER_NOT_FOUND");

            const customer = await stripe.customers.create({
                email: userResult.email,
                metadata: { user_id: userId },
            });

            stripeCustomerId = customer.id;
            await subscriptionsRepository.setStripeCustomerId(userId, stripeCustomerId);
        }

        const venueData = {
            name: data.name,
            street_address: data.street_address,
            city: data.city,
            state_province: data.state_province || '',
            postal_code: data.postal_code,
            country: data.country,
            phone: data.phone || '',
            email: data.email || '',
            capacity: data.capacity || 0,
        };
        const venueDataStr = JSON.stringify(venueData);

        const successUrl = data.success_url 
            ? `${data.success_url}?checkout=success&session_id={CHECKOUT_SESSION_ID}` 
            : `${CHECKOUT_URLS.SUCCESS}&session_id={CHECKOUT_SESSION_ID}`;
        
        const cancelUrl = data.cancel_url || CHECKOUT_URLS.CANCEL;

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card', 'sepa_debit'],
            mode: 'subscription',
            line_items: [{
                price_data: {
                    currency: plan.currency,
                    product_data: {
                        name: `Match - Abonnement ${plan.name}`,
                        description: `Abonnement pour ${data.name}`,
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

        return { 
            checkout_url: session.url,
            session_id: session.id,
            message: 'Please complete payment to create your venue'
        };
    }

    async verifyCheckoutAndCreateVenue(userId: string, sessionId: string) {
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['subscription']
        });

        if (session.metadata?.user_id !== userId) {
            throw new Error("SESSION_USER_MISMATCH");
        }

        if (session.payment_status !== 'paid') {
            throw new Error("PAYMENT_NOT_COMPLETED");
        }

        if (session.metadata?.action !== 'create_venue') {
            throw new Error("INVALID_SESSION_ACTION");
        }

        const venueDataStr = session.metadata.venue_data;
        if (!venueDataStr) {
            throw new Error("MISSING_VENUE_DATA");
        }

        const existingVenues = await this.partnerRepo.getVenuesByOwnerId(userId);
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
            return { 
                venue: existingVenue, 
                message: "Venue already created",
                already_exists: true 
            };
        }

        const stripeSubscription = session.subscription as any;
        const planId = session.metadata.plan_id || 'monthly';
        const plan = planId === 'annual' ? 'pro' : 'basic';

        const commitmentEndDate = new Date();
        commitmentEndDate.setFullYear(commitmentEndDate.getFullYear() + 1);

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

        const newVenue = await this.partnerRepo.createVenue({
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

        return { 
            venue: newVenue, 
            subscription: newSubscription,
            message: "Venue created successfully" 
        };
    }

    async scheduleMatch(userId: string, venueId: string, data: any) {
        // Verify ownership
        const isOwner = await this.partnerRepo.verifyVenueOwnership(venueId, userId);
        if (!isOwner) {
            throw new Error("FORBIDDEN");
        }

        const { match_id, total_capacity, capacity } = data;
        const finalCapacity = total_capacity ?? capacity;
        
        if (!finalCapacity) {
            throw new Error("Capacity is required");
        }

        return await this.partnerRepo.scheduleMatch(venueId, match_id, finalCapacity);
    }

    async cancelMatch(venueId: string, matchId: string) {
        await this.partnerRepo.cancelMatch(venueId, matchId);
        return { success: true };
    }

    async getMyMatches(userId: string) {
        const venueIds = await this.partnerRepo.getVenueIdsByOwnerId(userId);
        
        if (venueIds.length === 0) {
            return [];
        }

        const venueMatches = await this.partnerRepo.getVenueMatchesByVenueIds(venueIds);
        const now = new Date();

        return venueMatches.map(vm => {
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
    }

    async getVenueClients(userId: string, venueId: string) {
        const { authorized, clients } = await this.partnerRepo.getVenueClientsData(venueId, userId);

        if (!authorized) {
            throw new Error("FORBIDDEN");
        }

        return {
            clients: clients.map((r: any) => ({
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
            })),
            total: clients.length
        };
    }

    async getCustomerStats(userId: string, period: number) {
        const validPeriod = [7, 30, 90].includes(period) ? period : 30;
        const venueIds = await this.partnerRepo.getVenueIdsByOwnerId(userId);
        
        if (venueIds.length === 0) {
            return {
                customerCount: 0,
                totalGuests: 0,
                totalReservations: 0,
                period: validPeriod
            };
        }

        const stats = await this.partnerRepo.getCustomerStats(venueIds, validPeriod);
        return { ...stats, period: validPeriod };
    }

    async getAnalyticsSummary(userId: string, period: number) {
        const venueIds = await this.partnerRepo.getVenueIdsByOwnerId(userId);
        
        if (venueIds.length === 0) {
            return {
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
            };
        }

        const { venueMatches, clientStats, matchStats, totalViews, trends } = await this.partnerRepo.getAnalyticsSummary(venueIds, period);

        const now = new Date();
        const matchesUpcoming = matchStats.filter(m => 
            m.status !== 'finished' && new Date(m.scheduledAt) > now
        ).length;
        const matchesCompleted = matchStats.filter(m => 
            m.status === 'finished' || new Date(m.scheduledAt) <= now
        ).length;

        const totalCapacity = venueMatches.reduce((sum, vm) => sum + (vm.total_capacity || 0), 0);
        const totalReserved = venueMatches.reduce((sum, vm) => sum + (vm.reserved_capacity || 0), 0);
        const averageOccupancy = totalCapacity > 0 
            ? Math.round((totalReserved / totalCapacity) * 100) 
            : 0;

        return {
            total_clients: clientStats.uniqueUsers,
            total_reservations: clientStats.totalReservations,
            total_views: totalViews,
            matches_completed: matchesCompleted,
            matches_upcoming: matchesUpcoming,
            average_occupancy: averageOccupancy,
            trends,
        };
    }

    async getRecentActivity(userId: string, limit: number = 20) {
        return await this.partnerRepo.getRecentActivity(userId, limit);
    }

    async getVenueSubscription(userId: string, venueId: string) {
        const venue = await this.partnerRepo.getVenueByIdAndOwner(venueId, userId);
        if (!venue) throw new Error("FORBIDDEN");

        if (!venue.subscription_id) return null;

        const subscription = await subscriptionsRepository.getSubscriptionById(venue.subscription_id);
        if (!subscription) return null;

        const planInfo = {
            basic: { name: 'Mensuel', displayPrice: '30€/mois' },
            pro: { name: 'Annuel', displayPrice: '300€/an' },
            enterprise: { name: 'Enterprise', displayPrice: 'Sur devis' },
            trial: { name: 'Essai', displayPrice: 'Gratuit' },
        };

        const info = planInfo[subscription.plan as keyof typeof planInfo] || { name: subscription.plan, displayPrice: `${subscription.price}€` };

        return {
            ...subscription,
            plan_name: info.name,
            display_price: info.displayPrice,
        };
    }

    async getVenuePaymentPortal(userId: string, venueId: string) {
        if (!isStripeConfigured()) throw new Error("PAYMENT_SYSTEM_NOT_CONFIGURED");

        const venue = await this.partnerRepo.getVenueByIdAndOwner(venueId, userId);
        if (!venue) throw new Error("FORBIDDEN");

        const stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);
        if (!stripeCustomerId) throw new Error("NO_PAYMENT_PROFILE");

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: CHECKOUT_URLS.SUCCESS.replace('?checkout=success', ''),
        });

        return { portal_url: portalSession.url };
    }

    async updateReservationStatus(userId: string, reservationId: string, status: 'CONFIRMED' | 'DECLINED') {
        const result = await this.partnerRepo.updateReservationStatus(reservationId, userId, status);
        if (!result.success) {
            if (result.statusCode === 404) throw new Error("RESERVATION_NOT_FOUND");
            if (result.statusCode === 403) throw new Error("FORBIDDEN");
            throw new Error(result.error || "UPDATE_FAILED");
        }
        return result.reservation;
    }

    async getVenueReservations(userId: string, venueId: string, options: any) {
        const result = await this.partnerRepo.getVenueReservations(venueId, userId, options);
        if (!result.authorized) throw new Error("FORBIDDEN");
        return result;
    }

    async updateVenueMatch(userId: string, venueId: string, matchId: string, data: any) {
        const result = await this.partnerRepo.updateVenueMatch(venueId, matchId, userId, data);
        if (!result.success) {
            if (result.statusCode === 403) throw new Error("FORBIDDEN");
            throw new Error(result.error || "UPDATE_FAILED");
        }
        return result.venueMatch;
    }

    async getAnalyticsDashboard(userId: string, dateRange: any) {
        return await this.partnerRepo.getAnalyticsDashboard(userId, dateRange);
    }

    async getMatchesCalendar(userId: string, venueId: string, options: any) {
        const result = await this.partnerRepo.getMatchesCalendar(venueId, userId, options);
        if (!result.success) {
            if (result.statusCode === 403) throw new Error("FORBIDDEN");
            throw new Error(result.error || "FAILED");
        }
        return result;
    }

    async getReservationStats(userId: string, venueId: string, dateRange: any) {
        const result = await this.partnerRepo.getReservationStats(venueId, userId, dateRange);
        if (!result.success) {
            if (result.statusCode === 403) throw new Error("FORBIDDEN");
            throw new Error(result.error || "FAILED");
        }
        return result;
    }

    async updateReservationFull(userId: string, reservationId: string, data: any) {
        const result = await this.partnerRepo.updateReservation(reservationId, userId, data);
        if (!result.success) {
            if (result.statusCode === 403) throw new Error("FORBIDDEN");
            throw new Error(result.error || "UPDATE_FAILED");
        }
        return result.reservation;
    }

    async markReservationNoShow(userId: string, reservationId: string, reason?: string) {
        const result = await this.partnerRepo.markReservationNoShow(reservationId, userId, reason);
        if (!result.success) {
            if (result.statusCode === 403) throw new Error("FORBIDDEN");
            throw new Error(result.error || "MARK_NO_SHOW_FAILED");
        }
        return result;
    }

    async getVenueMatchWaitlist(userId: string, venueId: string, matchId: string, status?: string) {
        const venues = await this.partnerRepo.getVenuesByOwnerId(userId);
        const ownsVenue = venues.some(v => v.id === venueId);
        if (!ownsVenue) throw new Error("FORBIDDEN");

        // TODO: Get venue_match_id from venueId and matchId if needed, currently passing matchId as venueMatchId in controller logic
        const venueMatchId = matchId; 

        const entries = await this.waitlistRepo.getWaitlistForVenueMatch(venueMatchId, status);
        const totalWaitingSize = await this.waitlistRepo.getTotalWaitingPartySize(venueMatchId);

        return {
            waitlist: entries,
            summary: {
                total_entries: entries.length,
                waiting_entries: entries.filter(e => e.status === 'waiting').length,
                notified_entries: entries.filter(e => e.status === 'notified').length,
                total_party_size: totalWaitingSize,
            },
        };
    }

    async notifyWaitlistCustomer(userId: string, entryId: string, expiryMinutes: number) {
        const result = await this.waitlistRepo.notifyUserManually(entryId, expiryMinutes);
        if (!result.success) {
            throw new Error(result.error || "NOTIFY_FAILED");
        }
        return result;
    }
}
