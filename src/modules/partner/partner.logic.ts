import { PartnerRepository } from "../../repository/partner/partner.repository";
import { WaitlistRepository } from "../../repository/waitlist.repository";
import subscriptionsRepository from "../../repository/subscriptions.repository";
import stripe, { CHECKOUT_URLS, isStripeConfigured } from "../../config/stripe";
import { geocodeAddress } from "../../utils/geocoding";
import { notifyNewReservation, notifyReservationCancelled } from "../../services/notifications/notification.triggers";
import { resolveHasPaymentMethodLive } from "../../utils/stripe-payment-method";
import { assertVenueIsActiveForOperations } from "../../utils/venue-active.guard";
import { BillingRepository } from "../../repository/billing.repository";
import { ReservationRepository } from "../../repository/reservation.repository";

function formatStripePaymentMethod(paymentMethod: any) {
    if (!paymentMethod || paymentMethod.deleted) {
        return null;
    }

    if (paymentMethod.type === "card" && paymentMethod.card) {
        return {
            type: "card",
            brand: paymentMethod.card.brand || null,
            last4: paymentMethod.card.last4 || null,
            exp_month: paymentMethod.card.exp_month || null,
            exp_year: paymentMethod.card.exp_year || null,
        };
    }

    if (paymentMethod.type === "sepa_debit" && paymentMethod.sepa_debit) {
        return {
            type: "sepa_debit",
            brand: "SEPA",
            last4: paymentMethod.sepa_debit.last4 || null,
            exp_month: null,
            exp_year: null,
        };
    }

    return {
        type: paymentMethod.type || "other",
        brand: null,
        last4: null,
        exp_month: null,
        exp_year: null,
    };
}

function mapStripeSubscriptionStatus(status?: string) {
    if (status === "past_due") return "past_due" as const;
    if (status === "canceled") return "canceled" as const;
    if (status === "trialing") return "trialing" as const;
    return "active" as const;
}

function resolveStripeSubscriptionPeriod(
    stripeSubscription: any,
    fallbackStart?: Date | null,
    fallbackEnd?: Date | null,
) {
    const primaryItem = stripeSubscription?.items?.data?.[0];

    const startTimestamp =
        stripeSubscription?.current_period_start ??
        primaryItem?.current_period_start ??
        primaryItem?.current_period?.start ??
        null;

    const endTimestamp =
        stripeSubscription?.current_period_end ??
        primaryItem?.current_period_end ??
        primaryItem?.current_period?.end ??
        null;

    return {
        current_period_start: startTimestamp ? new Date(startTimestamp * 1000) : fallbackStart || null,
        current_period_end: endTimestamp ? new Date(endTimestamp * 1000) : fallbackEnd || null,
    };
}

function mapStripeInvoiceStatus(status?: string) {
    if (status === "paid") return "paid" as const;
    if (status === "draft") return "draft" as const;
    if (status === "void") return "canceled" as const;
    if (status === "uncollectible") return "overdue" as const;
    return "pending" as const;
}

function mapStripeInvoiceForVenue(invoice: any, userId: string, venueId: string, subscriptionId: string) {
    const createdDate = new Date((invoice.created || Date.now() / 1000) * 1000);
    const issueDate = createdDate.toISOString().split("T")[0]!;
    const dueDate = invoice.due_date
        ? new Date(invoice.due_date * 1000).toISOString().split("T")[0]!
        : issueDate;

    return {
        id: invoice.id,
        user_id: userId,
        invoice_number: invoice.number || invoice.id,
        subscription_id: subscriptionId,
        stripe_subscription_id: typeof invoice.subscription === "string" ? invoice.subscription : null,
        venue_id: venueId,
        status: mapStripeInvoiceStatus(invoice.status),
        issue_date: issueDate,
        due_date: dueDate,
        paid_date: invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000).toISOString().split("T")[0]!
            : null,
        subtotal: String((invoice.subtotal || 0) / 100),
        tax: String((invoice.tax || 0) / 100),
        total: String((invoice.total || 0) / 100),
        currency: invoice.currency?.toUpperCase() || "EUR",
        description: invoice.lines?.data?.[0]?.description || invoice.description || "Match subscription",
        pdf_url: invoice.invoice_pdf || null,
        created_at: createdDate,
        updated_at: createdDate,
    };
}

function normalizeInvoiceMatchValue(value?: string | null) {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function invoiceMatchesVenue(invoice: any, venueName: string, stripeSubscriptionId?: string | null) {
    if (stripeSubscriptionId && invoice.subscription === stripeSubscriptionId) {
        return true;
    }

    const normalizedVenueName = normalizeInvoiceMatchValue(venueName);
    if (!normalizedVenueName) {
        return false;
    }

    const searchableValues = [
        invoice.description,
        invoice.parent?.subscription_details?.metadata?.venue_name,
        invoice.subscription_details?.metadata?.venue_name,
        ...(invoice.lines?.data || []).map((line: any) => line?.description),
    ];

    return searchableValues.some((value) =>
        normalizeInvoiceMatchValue(String(value || "")).includes(normalizedVenueName),
    );
}

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

        const requiresPaymentSetup = !hasPaymentMethod;
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

        return {
            venue,
            is_first_venue: isFirstVenue,
            requires_payment_setup: requiresPaymentSetup,
            payment_setup_flow: requiresPaymentSetup ? "post_first_venue" : null,
        };
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
            type: data.type || 'sports_bar',
            description: data.description || null,
        };
        const venueDataStr = JSON.stringify(venueData);
        const venueName = String(data.name || '').trim();
        const stripeProductName = venueName ? `Match - ${venueName}` : `Match - Abonnement ${plan.name}`;
        const stripeProductDescription = venueName
            ? `Abonnement ${plan.name} pour ${venueName}`
            : `Abonnement ${plan.name}`;
        const stripeSubscriptionDescription = venueName
            ? `Abonnement ${plan.name} - ${venueName}`
            : `Match - Abonnement ${plan.name}`;

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
                        name: stripeProductName,
                        description: stripeProductDescription,
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
                venue_name: venueName,
                venue_data: venueDataStr,
                action: 'create_venue',
            },
            subscription_data: {
                description: stripeSubscriptionDescription,
                metadata: {
                    user_id: userId,
                    plan_id: planId,
                    venue_name: venueName,
                },
            },
            allow_promotion_codes: true,
        });

        return { 
            checkout_url: session.url,
            session_id: session.id,
            message: 'Please complete payment to create your venue',
        };
    }

    async verifyCheckoutAndCreateVenue(userId: string, sessionId: string) {
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['subscription'],
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
            v.street_address === venueData.street_address,
        );

        if (alreadyExists) {
            const existingVenue = existingVenues.find(v => 
                v.name === venueData.name && 
                v.street_address === venueData.street_address,
            );
            return { 
                venue: existingVenue, 
                message: "Venue already created",
                already_exists: true, 
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
                (stripeSubscription?.current_period_start || Date.now() / 1000) * 1000,
            ),
            current_period_end: new Date(
                (stripeSubscription?.current_period_end || Date.now() / 1000) * 1000,
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
            type: venueData.type || 'sports_bar',
            description: venueData.description || null,
        });

        return { 
            venue: newVenue, 
            subscription: newSubscription,
            message: "Venue created successfully", 
        };
    }

    async scheduleMatch(userId: string, venueId: string, data: any) {
        const venue = await this.partnerRepo.getVenueByIdAndOwner(venueId, userId);
        if (!venue) {
            throw new Error("FORBIDDEN");
        }

        assertVenueIsActiveForOperations(venue);

        if (venue.subscription_status === "canceled") {
            throw new Error("VENUE_INACTIVE_PAYMENT_REQUIRED");
        }

        if (venue.subscription_id) {
            const subscription = await subscriptionsRepository.getSubscriptionById(venue.subscription_id);
            if (
                !subscription ||
                subscription.status === "canceled" ||
                (!subscription.auto_renew && subscription.current_period_end && new Date(subscription.current_period_end) <= new Date())
            ) {
                await this.partnerRepo.updateVenueSubscriptionState(venue.subscription_id, {
                    subscription_status: "canceled",
                    is_active: false,
                    status: "suspended",
                });
                throw new Error("VENUE_INACTIVE_PAYMENT_REQUIRED");
            }
        }

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

    async getVenueSubscription(userId: string, venueId: string) {
        const venue = await this.partnerRepo.getVenueByIdAndOwner(venueId, userId);
        if (!venue) throw new Error("FORBIDDEN");

        if (!venue.subscription_id) return null;

        let subscription = await subscriptionsRepository.getSubscriptionById(venue.subscription_id);
        if (!subscription) return null;

        const planInfo = {
            basic: { name: 'Mensuel', displayPrice: '30€/mois' },
            pro: { name: 'Annuel', displayPrice: '300€/an' },
            enterprise: { name: 'Enterprise', displayPrice: 'Sur devis' },
            trial: { name: 'Essai', displayPrice: 'Gratuit' },
        };

        const info = planInfo[subscription.plan as keyof typeof planInfo] || { name: subscription.plan, displayPrice: `${subscription.price}€` };
        let paymentMethod = null;
        let nextBillingAt = subscription.current_period_end;
        let cancelAtPeriodEnd = subscription.auto_renew === false;
        let willRenew = subscription.auto_renew !== false && !subscription.canceled_at && subscription.status !== "canceled";

        if (
            isStripeConfigured() &&
            subscription.stripe_subscription_id &&
            !subscription.stripe_subscription_id.startsWith("mock_") &&
            !subscription.stripe_subscription_id.startsWith("pending_")
        ) {
            try {
                const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
                    expand: ["default_payment_method"],
                }) as any;
                const stripeWillRenew = !(
                    stripeSubscription.cancel_at_period_end ||
                    stripeSubscription.cancel_at ||
                    stripeSubscription.canceled_at ||
                    stripeSubscription.status === "canceled"
                );
                const stripePeriod = resolveStripeSubscriptionPeriod(
                    stripeSubscription,
                    subscription.current_period_start,
                    subscription.current_period_end,
                );

                subscription =
                    (await subscriptionsRepository.updateSubscription(subscription.id, {
                        status: mapStripeSubscriptionStatus(stripeSubscription.status),
                        current_period_start: stripePeriod.current_period_start || subscription.current_period_start,
                        current_period_end: stripePeriod.current_period_end || subscription.current_period_end,
                        auto_renew: stripeWillRenew,
                        canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
                        stripe_payment_method_id:
                            (typeof stripeSubscription.default_payment_method === "string"
                                ? stripeSubscription.default_payment_method
                                : stripeSubscription.default_payment_method?.id) ||
                            subscription.stripe_payment_method_id,
                    })) || subscription;
                cancelAtPeriodEnd = Boolean(stripeSubscription.cancel_at_period_end);
                willRenew = stripeWillRenew;

                if (typeof stripeSubscription.default_payment_method === "string") {
                    if (subscription.stripe_payment_method_id && subscription.stripe_payment_method_id !== "unknown") {
                        const stripePaymentMethod = await stripe.paymentMethods.retrieve(subscription.stripe_payment_method_id);
                        paymentMethod = formatStripePaymentMethod(stripePaymentMethod);
                    }
                } else {
                    paymentMethod = formatStripePaymentMethod(stripeSubscription.default_payment_method);
                }

                const stripeCustomerId = await subscriptionsRepository.getStripeCustomerId(userId);
                if (stripeCustomerId && willRenew) {
                    try {
                        const upcomingInvoice = await stripe.invoices.createPreview({
                            customer: stripeCustomerId,
                            subscription: subscription.stripe_subscription_id,
                        }) as any;

                        if (upcomingInvoice?.period_end) {
                            nextBillingAt = new Date(upcomingInvoice.period_end * 1000);
                        } else if (upcomingInvoice?.next_payment_attempt) {
                            nextBillingAt = new Date(upcomingInvoice.next_payment_attempt * 1000);
                        } else if (upcomingInvoice?.lines?.data?.[0]?.period?.end) {
                            nextBillingAt = new Date(upcomingInvoice.lines.data[0].period.end * 1000);
                        }
                    } catch (error: any) {
                        if (error?.code !== "invoice_upcoming_none") {
                            console.error("Error fetching Stripe upcoming invoice:", error);
                        }
                    }
                }
            } catch (error) {
                console.error("Error syncing Stripe subscription/payment method:", error);
            }
        }

        return {
            ...subscription,
            plan_name: info.name,
            display_price: info.displayPrice,
            payment_method: paymentMethod,
            next_billing_at: nextBillingAt,
            cancel_at_period_end: cancelAtPeriodEnd,
            auto_renew: willRenew,
            will_renew: willRenew,
        };
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
        const result = await this.waitlistRepo.notifyUserManually(entryId, expiryMinutes);
        if (!result.success) {
            throw new Error(result.error || "NOTIFY_FAILED");
        }
        return result;
    }
}
