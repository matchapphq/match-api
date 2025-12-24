import { db } from "../config/config.db";
import { venuesTable } from "../config/db/venues.table";
import { eq, and, isNull, or, ilike, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { CreateVenueInput, UpdateVenueInput, GetVenuesQuery } from "../types/venue.types";
import { venuePhotosTable } from "../config/db/venue-photos.table";

export class VenueRepository {

    async create(userId: string, subscriptionId: string, input: CreateVenueInput) {
        return await db.transaction(async (tx) => {
            // PostGIS point: SRID 4326 (WGS 84) is standard for GPS
            const locationSql = sql`ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)`;

            const [newVenue] = await tx.insert(venuesTable).values({
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

            if (!newVenue) {
                throw new Error("Failed to create venue");
            }

            if (input.photos && input.photos.length > 0) {
                await tx.insert(venuePhotosTable).values(
                    input.photos.map(p => ({
                        venue_id: newVenue.id,
                        photo_url: p.url,
                        alt_text: p.altText,
                        is_primary: p.isPrimary ?? false,
                        uploaded_by: userId
                    }))
                );
            }

            return newVenue;
        });
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

    async findAll(query: GetVenuesQuery) {
        const {
            page = 1,
            limit = 20,
            city,
            type,
            is_verified,
            search,
            lat,
            lng,
            distance_km = 10,
            sort = 'newest'
        } = query;

        const offset = (page - 1) * limit;

        const conditions = [
            isNull(venuesTable.deleted_at),
            eq(venuesTable.is_active, true)
        ];

        if (city) conditions.push(ilike(venuesTable.city, `%${city}%`));
        if (type) conditions.push(eq(venuesTable.type, type as any));
        if (is_verified !== undefined) conditions.push(eq(venuesTable.is_verified, is_verified));

        if (search) {
            conditions.push(or(
                ilike(venuesTable.name, `%${search}%`),
                ilike(venuesTable.description ?? sql`''`, `%${search}%`)
            )!);
        }

        if (lat && lng && distance_km) {
            // PostGIS: ST_DWithin(geography(location), geography(ST_MakePoint(lng, lat)), distance_meters)
            // Note: locations in DB are SRID 4326 geometry. Casting to geography calculates distance in meters.
            const distanceMeters = distance_km * 1000;
            conditions.push(sql`ST_DWithin(
                ${venuesTable.location}::geography, 
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 
                ${distanceMeters}
            )`);
        }

        let orderByClause: any = desc(venuesTable.created_at);

        if (sort === 'rating') {
            orderByClause = desc(venuesTable.average_rating);
        } else if (sort === 'distance' && lat && lng) {
            // Order by distance
            orderByClause = sql`ST_Distance(
                ${venuesTable.location}::geography, 
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
            )`;
        }

        // 1. Get total count for pagination metadata
        // Note: Drizzle doesn't have a simple "count with query" helper yet that preserves all current 'where' without rebuilding
        // We'll rebuild the where clause for count
        const whereClause = and(...conditions);

        const [countRes] = await db.select({ count: sql<number>`count(*)` })
            .from(venuesTable)
            .where(whereClause);

        const total = Number(countRes?.count ?? 0);
        const totalPages = Math.ceil(total / limit);

        // 2. Fetch data
        const data = await db.query.venuesTable.findMany({
            where: whereClause,
            limit: limit,
            offset: offset,
            orderBy: orderByClause,
            with: {
                photos: true
            }
        });

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        };
    }

    async findByOwnerId(ownerId: string) {
        return await db.query.venuesTable.findMany({
            where: and(eq(venuesTable.owner_id, ownerId), isNull(venuesTable.deleted_at))
        });
    }
}
