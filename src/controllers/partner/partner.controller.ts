import { createFactory } from "hono/factory";
import { db } from "../../config/config.db";
import { venuesTable } from "../../config/db/venues.table";
import { venueMatchesTable } from "../../config/db/matches.table";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

class PartnerController {
    private readonly factory = createFactory();

    // GET /partners/venues
    readonly getMyVenues = this.factory.createHandlers(async (c) => {
        // TODO: Get real user ID from auth context
        // const userId = c.get('user').id;
        const userId = "test-user-id"; // Placeholder

        try {
            const venues = await db.select()
                .from(venuesTable)
                .where(eq(venuesTable.owner_id, userId));

            return c.json({ venues });
        } catch (error: any) {
            console.error("Error fetching venues:", error);
            return c.json({ error: "Failed to fetch venues" }, 500);
        }
    });

    // POST /partners/venues
    readonly createVenue = this.factory.createHandlers(async (c) => {
        // const userId = c.get('user').id;
        const userId = "test-user-id"; // Placeholder

        try {
            const body = await c.req.json();

            // Basic validation
            if (!body.name || !body.street_address || !body.city || !body.postal_code || !body.country) {
                return c.json({ error: "Missing required address fields" }, 400);
            }

            // Note: We are using placeholders for required standard fields to make this work 
            // without a full frontend form. In a real app, these come from the body.
            const [newVenue] = await db.insert(venuesTable).values({
                name: body.name,
                owner_id: userId, // foreign key to users table
                subscription_id: "00000000-0000-0000-0000-000000000000", // Placeholder: requires valid FK to subscriptions

                // Address
                street_address: body.street_address,
                city: body.city,
                state_province: body.state_province || "",
                postal_code: body.postal_code,
                country: body.country,

                // Geo - Using raw SQL for PostGIS point (SRID 4326)
                // If not using PostGIS driver, this might fail, but schema defines it as geometry
                location: sql`ST_SetSRID(ST_MakePoint(0, 0), 4326)`,
                latitude: 0,
                longitude: 0,

                // Required Enums
                type: 'sports_bar', // specific enum value required

                // Defaults
                status: 'pending',
                is_active: true
            }).returning();

            return c.json({ venue: newVenue }, 201);
        } catch (error: any) {
            console.error("Error creating venue:", error);
            return c.json({ error: "Failed to create venue", details: error.message }, 500);
        }
    });

    // POST /partners/venues/:venueId/matches
    readonly scheduleMatch = this.factory.createHandlers(async (c) => {
        const venueId = c.req.param("venueId");

        try {
            const body = await c.req.json();
            const { match_id, total_seats, base_price } = body;

            if (!match_id || !total_seats) {
                return c.json({ error: "match_id and total_seats are required" }, 400);
            }

            const [venueMatch] = await db.insert(venueMatchesTable).values({
                venue_id: venueId,
                match_id: match_id,
                total_seats: total_seats,
                available_seats: total_seats, // Initially all available
                base_price: base_price || "0.00",
                pricing_type: "per_seat",
                is_active: true
            }).returning();

            return c.json({ venueMatch }, 201);
        } catch (error: any) {
            console.error("Error scheduling match:", error);
            // Check for unique constraint violation
            if (error.code === '23505') {
                return c.json({ error: "Match already scheduled at this venue" }, 409);
            }
            return c.json({ error: "Failed to schedule match", details: error.message }, 500);
        }
    });

    // DELETE /partners/venues/:venueId/matches/:matchId
    readonly cancelMatch = this.factory.createHandlers(async (c) => {
        const venueId = c.req.param("venueId");
        const matchId = c.req.param("matchId");

        try {
            await db.delete(venueMatchesTable)
                .where(and(
                    eq(venueMatchesTable.venue_id, venueId),
                    eq(venueMatchesTable.match_id, matchId)
                ));

            return c.json({ success: true });
        } catch (error: any) {
            console.error("Error canceling match:", error);
            return c.json({ error: "Failed to cancel match" }, 500);
        }
    });
}

export default PartnerController;
