import { PartnerRepository } from "../../repository/partner/partner.repository";
import { WaitlistRepository } from "../../repository/waitlist.repository";
import subscriptionsRepository from "../../repository/subscriptions.repository";
import stripe, { CHECKOUT_URLS, isStripeConfigured } from "../../config/stripe";
import { notifyNewReservation, notifyReservationCancelled } from "../../services/notifications/notification.triggers";
import { resolveHasPaymentMethodLive } from "../../utils/stripe-payment-method";
import { assertVenueIsActiveForOperations } from "../../utils/venue-active.guard";
import { BillingRepository } from "../../repository/billing.repository";
import { ReservationRepository } from "../../repository/reservation.repository";
import UserRepository from "../../repository/user.repository";

function extractReservationIdsFromBillingNotes(notes?: string | null) {
    if (!notes) return [];

    try {
        const parsed = JSON.parse(notes) as { reservation_ids?: unknown };
        if (!Array.isArray(parsed.reservation_ids)) {
            return [];
        }

        return parsed.reservation_ids
            .filter((value): value is string => typeof value === "string");
    } catch {
        return [];
    }
}

export class PartnerLogic {
    constructor(
        private readonly partnerRepo: PartnerRepository,
        private readonly waitlistRepo: WaitlistRepository,
        private readonly billingRepo: BillingRepository = new BillingRepository(),
        private readonly reservationRepo: ReservationRepository = new ReservationRepository(),
        private readonly userRepository: UserRepository = new UserRepository(),
    ) {}

    async getMyVenues(userId: string) {
        return await this.partnerRepo.getVenuesByOwnerId(userId);
    }

    async createVenue(userId: string, data: any) {
        const venues = await this.partnerRepo.getVenuesByOwnerId(userId);
        const isFirstVenue = venues.length === 0;

        const stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);
        const hasPaymentMethod = await resolveHasPaymentMethodLive(stripeCustomerId);

        if (!hasPaymentMethod && !isFirstVenue) {
            throw new Error("PAYMENT_METHOD_REQUIRED");
        }

        const requiresPaymentSetup = !hasPaymentMethod && process.env.NODE_ENV !== "development";
        const venue = await this.partnerRepo.createVenue({
            name: data.name,
            owner_id: userId,
            street_address: data.street_address,
            city: data.city,
            state_province: data.state_province || '',
            postal_code: data.postal_code,
            country: data.country,
            phone: data.phone || '',
            email: data.email || '',
            capacity: data.capacity || 0,
            type: data.type || 'sports_bar',
            description: data.description || null,
            commission_override: data.commission_override,
            status: requiresPaymentSetup ? "pending" : "approved",
            is_active: !requiresPaymentSetup,
        });

        if (!venue) {
            throw new Error("VENUE_CREATION_FAILED");
        }

        if (isFirstVenue && !hasPaymentMethod) {
            try {
                await this.userRepository.setPartnerOnboardingStep(userId, "paiement_method");
            } catch (error) {
                console.warn("Unable to persist onboarding step after first venue creation:", error);
            }
        }

        return {
            venue,
            venue_id: venue.id,
            is_first_venue: isFirstVenue,
            requires_payment_setup: requiresPaymentSetup,
            payment_setup_flow: requiresPaymentSetup ? "post_first_venue" : null,
        };
    }

    async scheduleMatch(userId: string, venueId: string, data: any) {
        const venue = await this.partnerRepo.getVenueByIdAndOwner(venueId, userId);
        if (!venue) {
            throw new Error("FORBIDDEN");
        }

        assertVenueIsActiveForOperations(venue);

        const { match_id, total_capacity, capacity } = data;
        const finalCapacity = total_capacity ?? capacity;
        
        if (!finalCapacity) {
            throw new Error("Capacity is required");
        }

        return await this.partnerRepo.scheduleMatch(venueId, match_id, finalCapacity);
    }

    async cancelMatch(userId: string, venueId: string, matchId: string) {
        const venue = await this.partnerRepo.getVenueByIdAndOwner(venueId, userId);
        if (!venue) {
            throw new Error("FORBIDDEN");
        }

        assertVenueIsActiveForOperations(venue);
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
            total: clients.length,
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
                period: validPeriod,
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
                    views: 0,
                },
            };
        }

        const { venueMatches, clientStats, matchStats, totalViews, trends } = await this.partnerRepo.getAnalyticsSummary(venueIds, period);

        const now = new Date();
        const matchesUpcoming = matchStats.filter(m => 
            m.status !== 'finished' && new Date(m.scheduledAt) > now,
        ).length;
        const matchesCompleted = matchStats.filter(m => 
            m.status === 'finished' || new Date(m.scheduledAt) <= now,
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

    async getVenueInvoices(userId: string, venueId: string) {
        const venue = await this.partnerRepo.getVenueByIdAndOwner(venueId, userId);
        if (!venue) throw new Error("FORBIDDEN");

        const transactions = await this.billingRepo.getCommissionTransactionsWithInvoices(userId, 300);
        if (transactions.length === 0) {
            return [];
        }

        const reservationIds = Array.from(new Set(
            transactions.flatMap((transaction) => extractReservationIdsFromBillingNotes(transaction.notes)),
        ));
        if (reservationIds.length === 0) {
            return [];
        }

        const reservationVenueById = await this.reservationRepo.getVenueIdsByReservationIds(reservationIds);
        const invoicesById = new Map<string, any>();
        const missingPdfByInvoiceId = new Map<string, string>();

        for (const transaction of transactions) {
            const invoice = transaction.invoice;
            if (!invoice) {
                continue;
            }

            const linkedReservationIds = extractReservationIdsFromBillingNotes(transaction.notes);
            const hasVenueReservation = linkedReservationIds.some(
                (reservationId) => reservationVenueById.get(reservationId) === venueId,
            );

            if (hasVenueReservation) {
                invoicesById.set(invoice.id, invoice);
                if (!invoice.pdf_url && transaction.stripe_transaction_id) {
                    missingPdfByInvoiceId.set(invoice.id, transaction.stripe_transaction_id);
                }
            }
        }

        if (missingPdfByInvoiceId.size > 0) {
            try {
                const stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);
                if (stripeCustomerId) {
                    const stripeInvoices = await stripe.invoices.list({
                        customer: stripeCustomerId,
                        limit: 100,
                    });

                    const stripeInvoiceByPaymentIntentId = new Map<string, any>();
                    for (const stripeInvoice of stripeInvoices.data) {
                        const paymentIntentId = stripeInvoice.metadata?.payment_intent_id;
                        if (paymentIntentId) {
                            stripeInvoiceByPaymentIntentId.set(paymentIntentId, stripeInvoice);
                        }
                    }

                    for (const [invoiceId, stripeTransactionId] of missingPdfByInvoiceId.entries()) {
                        const stripeInvoice = stripeInvoiceByPaymentIntentId.get(stripeTransactionId);
                        const fallbackUrl = stripeInvoice?.invoice_pdf || stripeInvoice?.hosted_invoice_url || null;
                        if (!fallbackUrl) {
                            continue;
                        }

                        const existingInvoice = invoicesById.get(invoiceId);
                        if (existingInvoice) {
                            existingInvoice.pdf_url = fallbackUrl;
                            invoicesById.set(invoiceId, existingInvoice);
                        }

                        await this.billingRepo.updateInvoicePdfUrl(invoiceId, fallbackUrl);
                    }
                }
            } catch (error) {
                console.error("Error enriching commission invoice URLs from Stripe:", error);
            }
        }

        return Array.from(invoicesById.values())
            .sort((a, b) => new Date(b.issue_date || b.created_at).getTime() - new Date(a.issue_date || a.created_at).getTime());
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
        const venue = await this.partnerRepo.getReservationVenueByOwner(reservationId, userId);
        if (!venue) {
            throw new Error("FORBIDDEN");
        }

        assertVenueIsActiveForOperations(venue);
        const result = await this.partnerRepo.updateReservationStatus(reservationId, userId, status);
        if (!result.success) {
            if (result.statusCode === 404) throw new Error("RESERVATION_NOT_FOUND");
            if (result.statusCode === 403) throw new Error("FORBIDDEN");
            throw new Error(result.error || "UPDATE_FAILED");
        }

        const reservation = result.reservation;
        
        // Trigger notifications
        if (status === 'CONFIRMED') {
            notifyNewReservation({
                venueMatchId: reservation.venue_match_id,
                reservationId: reservation.id,
                userId: reservation.user_id,
                partySize: reservation.party_size,
                status: 'confirmed',
            }).catch(err => console.error('Failed to send confirmation notification:', err));
        } else {
            notifyReservationCancelled({
                venueMatchId: reservation.venue_match_id,
                reservationId: reservation.id,
                userId: reservation.user_id,
                partySize: reservation.party_size,
                reason: 'Refusée par l\'établissement',
            }).catch(err => console.error('Failed to send cancellation notification:', err));
        }

        return reservation;
    }

    async getVenueReservations(userId: string, venueId: string, options: any) {
        const result = await this.partnerRepo.getVenueReservations(venueId, userId, options);
        if (!result.authorized) throw new Error("FORBIDDEN");
        return result;
    }

    async updateVenueMatch(userId: string, venueId: string, matchId: string, data: any) {
        const venue = await this.partnerRepo.getVenueByIdAndOwner(venueId, userId);
        if (!venue) {
            throw new Error("FORBIDDEN");
        }

        assertVenueIsActiveForOperations(venue);
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
        const venue = await this.partnerRepo.getReservationVenueByOwner(reservationId, userId);
        if (!venue) {
            throw new Error("FORBIDDEN");
        }

        assertVenueIsActiveForOperations(venue);
        const result = await this.partnerRepo.updateReservation(reservationId, userId, data);
        if (!result.success) {
            if (result.statusCode === 403) throw new Error("FORBIDDEN");
            throw new Error(result.error || "UPDATE_FAILED");
        }
        return result.reservation;
    }

    async markReservationNoShow(userId: string, reservationId: string, reason?: string) {
        const venue = await this.partnerRepo.getReservationVenueByOwner(reservationId, userId);
        if (!venue) {
            throw new Error("FORBIDDEN");
        }

        assertVenueIsActiveForOperations(venue);
        const result = await this.partnerRepo.markReservationNoShow(reservationId, userId, reason);
        if (!result.success) {
            if (result.statusCode === 403) throw new Error("FORBIDDEN");
            throw new Error(result.error || "MARK_NO_SHOW_FAILED");
        }
        return result;
    }

    async getVenueMatchWaitlist(userId: string, venueId: string, matchId: string, status?: string) {
        const venue = await this.partnerRepo.getVenueByIdAndOwner(venueId, userId);
        if (!venue) {
            throw new Error("FORBIDDEN");
        }

        assertVenueIsActiveForOperations(venue);

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
        const venue = await this.waitlistRepo.getVenueOperationalStateByWaitlistEntry(entryId, userId);
        if (!venue) {
            throw new Error("FORBIDDEN");
        }

        assertVenueIsActiveForOperations(venue);
        const result = await this.waitlistRepo.notifyUserManually(entryId, expiryMinutes);
        if (!result.success) {
            throw new Error(result.error || "NOTIFY_FAILED");
        }
        return result;
    }
}
