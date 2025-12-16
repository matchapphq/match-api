import { db } from "../config/config.db";
import { venuesTable } from "../config/db/venues.table";
import { eq, and, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { CreateVenueInput, UpdateVenueInput } from "../types/venue.types";
import { venuePhotosTable } from "../config/db/venue-photos.table";

export class VenueRepository {

    async create(userId: string, subscriptionId: string, input: CreateVenueInput) {
        // PostGIS point: SRID 4326 (WGS 84) is standard for GPS
        const locationSql = sql`ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)`;

        const [newVenue] = await db.insert(venuesTable).values({
            owner_id: userId,
            subscription_id: subscriptionId,
            name: input.name,
            street_address: input.address, // mapping address to street_address for now, might need split
            city: input.city ?? "Unknown",
            postal_code: input.postalCode ?? "00000",
            country: input.country ?? "Unknown",
            location: locationSql as any,
            latitude: input.lat,
            longitude: input.lng,
            capacity: input.capacity,
            // maxSimultaneousBroadcasts: input.maxSimultaneousBroadcasts ?? 2, // Not in DB Schema yet
            type: input.type ?? "bar",
            description: input.description,
            phone: input.phone,
            email: input.email,
            website: input.website,
            status: "pending",
        }).returning();

        return newVenue;
    }

    async findById(venueId: string) {
        // Exclude soft-deleted venues
        const venue = await db.query.venuesTable.findFirst({
            where: and(eq(venuesTable.id, venueId), isNull(venuesTable.deleted_at)),
            with: {
                // @ts-ignore - Relation definition might be missing in relations.ts or strictly typed differently, but standard for Drizzle
                photos: true
            }
        });
        return venue;
    }

    async update(venueId: string, input: UpdateVenueInput) {
        const updateData: any = { ...input };

        if (input.lat !== undefined && input.lng !== undefined) {
            updateData.location = sql`ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)`;
            updateData.latitude = input.lat;
            updateData.longitude = input.lng;
        }

        if (input.address) {
            updateData.street_address = input.address;
        }

        // Remove flattened fields to avoid "column not found" if they don't map 1:1 or are handled above
        delete updateData.address;
        delete updateData.lat;
        delete updateData.lng;

        updateData.updated_at = new Date();

        const [updated] = await db.update(venuesTable)
            .set(updateData)
            .where(eq(venuesTable.id, venueId))
            .returning();

        return updated;
    }

    async softDelete(venueId: string) {
        await db.update(venuesTable)
            .set({ deleted_at: new Date() })
            .where(eq(venuesTable.id, venueId));
        return true;
    }

    async findByOwnerId(ownerId: string) {
        return await db.query.venuesTable.findMany({
            where: and(eq(venuesTable.owner_id, ownerId), isNull(venuesTable.deleted_at))
        });
    }
}
