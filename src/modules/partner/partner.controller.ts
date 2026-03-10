import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { z } from "zod";
import type { HonoEnv } from "../../types/hono.types";
import { PartnerLogic } from "./partner.logic";

class PartnerController {
    private readonly factory = createFactory<HonoEnv>();

    constructor(private readonly partnerLogic: PartnerLogic) {}

    // GET /partners/venues
    readonly getMyVenues = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const venues = await this.partnerLogic.getMyVenues(userId);
            return ctx.json({ venues });
        } catch (error: any) {
            console.error("Error fetching venues:", error);
            return ctx.json({ error: "Failed to fetch venues" }, 500);
        }
    });

    // POST /partners/venues
    public readonly createVenue = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const body = await ctx.req.json();

            // Basic validation
            if (!body.name || !body.street_address || !body.city || !body.postal_code || !body.country) {
                return ctx.json({ error: "Missing required address fields" }, 400);
            }            
            
            const result = await this.partnerLogic.createVenue(userId, body);
            return ctx.json(result, 201);
        } catch (error: any) {
            if (error.message === "PAYMENT_METHOD_REQUIRED") {
                return ctx.json({
                    error: "PAYMENT_METHOD_REQUIRED",
                    message: "A payment method is required before creating additional venues.",
                }, 403);
            }
            
            console.error("Error creating venue:", error);
            return ctx.json({ error: "Failed to create venue", details: error.message }, 500);
        }
    });

    // POST /partners/venues/verify-checkout
    public readonly verifyCheckoutAndCreateVenue = this.factory.createHandlers(async (ctx) => {
        return ctx.json({
            error: "ENDPOINT_DEPRECATED",
            message: "This endpoint is deprecated. Venue creation is now commission-only and does not require subscription checkout verification.",
        }, 410);
    });

    // POST /partners/venues/:venueId/matches
    readonly scheduleMatch = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param("venueId");

        try {
            const body = await ctx.req.json();
            const { match_id, total_capacity, capacity } = body;
            const finalCapacity = total_capacity ?? capacity;

            if (!venueId || !match_id || !finalCapacity) {
                return ctx.json({ error: "venueId, match_id and capacity are required" }, 400);
            }

            const venueMatch = await this.partnerLogic.scheduleMatch(userId, venueId, body);
            return ctx.json({ venueMatch }, 201);
        } catch (error: any) {
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Venue not found or access denied" }, 403);
            if (error.message === "VENUE_SUBSCRIPTION_INACTIVE") {
                return ctx.json({ error: "Venue subscription inactive", message: "L’abonnement de ce lieu est terminé. Le lieu est désormais inactif et ne peut plus programmer de match." }, 403);
            }
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

            await this.partnerLogic.cancelMatch(venueId, matchId);
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
            const data = await this.partnerLogic.getMyMatches(userId);
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

            const result = await this.partnerLogic.getVenueClients(userId, venueId);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Venue not found or access denied" }, 403);
            console.error("Error fetching venue clients:", error);
            return ctx.json({ error: "Failed to fetch clients", details: error.message }, 500);
        }
    });

    // GET /partners/stats/customers
    readonly getCustomerStats = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get("user").id;

        try {
            const periodParam = ctx.req.query('period');
            const period = periodParam ? parseInt(periodParam, 10) : 30;
            
            const stats = await this.partnerLogic.getCustomerStats(userId, period);
            return ctx.json(stats);
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
            const summary = await this.partnerLogic.getAnalyticsSummary(userId, period);
            return ctx.json(summary);
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
            const activity = await this.partnerLogic.getRecentActivity(userId, limit);
            return ctx.json({ activity });
        } catch (error: any) {
            console.error("Error fetching recent activity:", error);
            return ctx.json({ error: "Failed to fetch recent activity", details: error.message }, 500);
        }
    });

    // GET /partners/venues/:venueId/subscription
    readonly getVenueSubscription = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');

        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        try {
            const subscription = await this.partnerLogic.getVenueSubscription(userId, venueId);
            return ctx.json({ subscription });
        } catch (error: any) {
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Venue not found or access denied" }, 404);
            console.error("Error fetching venue subscription:", error);
            return ctx.json({ error: "Failed to fetch subscription", details: error.message }, 500);
        }
    });

    // GET /partners/venues/:venueId/invoices
    readonly getVenueInvoices = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');

        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        try {
            const invoices = await this.partnerLogic.getVenueInvoices(userId, venueId);
            return ctx.json({ invoices });
        } catch (error: any) {
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Venue not found or access denied" }, 404);
            console.error("Error fetching venue invoices:", error);
            return ctx.json({ error: "Failed to fetch invoices", details: error.message }, 500);
        }
    });

    // POST /partners/venues/:venueId/payment-portal
    readonly getVenuePaymentPortal = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');

        if (!venueId) {
            return ctx.json({ error: "Venue ID required" }, 400);
        }

        try {
            const result = await this.partnerLogic.getVenuePaymentPortal(userId, venueId);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "PAYMENT_SYSTEM_NOT_CONFIGURED") return ctx.json({ error: "Payment system not configured" }, 503);
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Venue not found or access denied" }, 404);
            if (error.message === "NO_PAYMENT_PROFILE") return ctx.json({ error: "No payment profile found" }, 404);

            console.error("Error creating payment portal:", error);
            return ctx.json({ error: "Failed to create payment portal", details: error.message }, 500);
        }
    });

    // PATCH /partners/reservations/:reservationId/status
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

            const reservation = await this.partnerLogic.updateReservationStatus(userId, reservationId, status);
            return ctx.json({ reservation });
        } catch (error: any) {
            if (error.message === "RESERVATION_NOT_FOUND") return ctx.json({ error: "Reservation not found" }, 404);
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Not authorized to manage this reservation" }, 403);
            
            console.error("Error updating reservation status:", error);
            return ctx.json({ error: error.message }, 500);
        }
    });

    // GET /partners/venues/:venueId/reservations
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

            const result = await this.partnerLogic.getVenueReservations(userId, venueId, { page, limit, status });

            return ctx.json({
                reservations: result.reservations,
                total: result.total,
                page: result.page,
                limit: result.limit,
            });
        } catch (error: any) {
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Venue not found or access denied" }, 403);
            console.error("Error getting venue reservations:", error);
            return ctx.json({ error: "Failed to get venue reservations", details: error.message }, 500);
        }
    });

    // PUT /partners/venues/:venueId/matches/:matchId
    readonly updateVenueMatch = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;
        const venueId = ctx.req.param('venueId');
        const matchId = ctx.req.param('matchId');

        if (!venueId || !matchId) {
            return ctx.json({ error: "Venue ID and Match ID required" }, 400);
        }

        try {
            const body = await ctx.req.json();
            const venueMatch = await this.partnerLogic.updateVenueMatch(userId, venueId, matchId, body);
            return ctx.json({ venueMatch });
        } catch (error: any) {
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Not authorized" }, 403);
            console.error("Error updating venue match:", error);
            return ctx.json({ error: error.message }, 500);
        }
    });

    // GET /partners/analytics/dashboard
    readonly getAnalyticsDashboard = this.factory.createHandlers(async (ctx) => {
        const userId = ctx.get('user').id;

        try {
            const startDate = ctx.req.query('start_date');
            const endDate = ctx.req.query('end_date');

            const dateRange = startDate ? {
                start: new Date(startDate),
                end: endDate ? new Date(endDate) : undefined,
            } : undefined;

            const dashboard = await this.partnerLogic.getAnalyticsDashboard(userId, dateRange);
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

            const result = await this.partnerLogic.getMatchesCalendar(userId, venueId, { month, status });

            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Not authorized" }, 403);
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

            const result = await this.partnerLogic.getReservationStats(userId, venueId, dateRange);
            return ctx.json({ stats: result.stats });
        } catch (error: any) {
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Not authorized" }, 403);
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
                const reservation = await this.partnerLogic.updateReservationFull(userId, reservationId, data);
                return ctx.json({ reservation });
            } catch (error: any) {
                if (error.message === "FORBIDDEN") return ctx.json({ error: "Not authorized to modify this reservation" }, 403);
                console.error("Error updating reservation:", error);
                return ctx.json({ error: error.message || "Failed to update reservation" }, 500);
            }
        },
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
                const result = await this.partnerLogic.markReservationNoShow(userId, reservationId, reason);
                return ctx.json(result);
            } catch (error: any) {
                if (error.message === "FORBIDDEN") return ctx.json({ error: "Not authorized to mark this reservation as no-show" }, 403);
                console.error("Error marking reservation as no-show:", error);
                return ctx.json({ error: error.message || "Failed to mark reservation as no-show" }, 500);
            }
        },
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
            const result = await this.partnerLogic.getVenueMatchWaitlist(userId, venueId, matchId, ctx.req.query('status'));
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "FORBIDDEN") return ctx.json({ error: "Not authorized to view this venue's waitlist" }, 403);
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
                const result = await this.partnerLogic.notifyWaitlistCustomer(userId, entryId, expiry_minutes);

                return ctx.json({
                    waitlistEntry: result.waitlistEntry,
                    notifications_sent: result.notifications_sent,
                    message: "Customer has been notified and has " + expiry_minutes + " minutes to claim their spot.",
                });
            } catch (error: any) {
                console.error("Error notifying waitlist customer:", error);
                return ctx.json({ error: "Failed to notify customer", details: error.message }, 500);
            }
        },
    );

}

export default PartnerController;
