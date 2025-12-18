import { db } from "../config/config.db";
import { tablesTable } from "../config/db/tables.table";
import { tableHoldsTable } from "../config/db/table-holds.table";
import { reservationsTable } from "../config/db/reservations.table";
import { venueMatchesTable } from "../config/db/matches.table";
import { eq, and, gte, notInArray, asc, sql } from "drizzle-orm";

export class TableRepository {

    // Find best fitting table:
    // 1. Capacity >= partySize
    // 2. Not held or reserved for this match
    // 3. Smallest capacity first (Best Fit)
    // 4. Accessibility match if required
    async findBestAvailableTable(matchId: string, partySize: number, accessible: boolean = false) {

        // 1. Get IDs of tables reserved or held for this match
        const reservedTableIds = await db.select({ id: reservationsTable.table_id })
            .from(reservationsTable)
            .where(and(
                eq(reservationsTable.venue_match_id, matchId),
                eq(reservationsTable.status, 'confirmed') // or pending
            ));

        const heldTableIds = await db.select({ id: tableHoldsTable.table_id })
            .from(tableHoldsTable)
            .where(and(
                eq(tableHoldsTable.venue_match_id, matchId),
                gte(tableHoldsTable.expires_at, new Date())
            ));

        const busyIds = [
            ...reservedTableIds.map(r => r.id),
            ...heldTableIds.map(h => h.id)
        ].filter(id => id !== null) as string[];

        // 2. Fetch Match to get VenueId
        const match = await db.query.venueMatchesTable.findFirst({
            where: eq(venueMatchesTable.id, matchId),
            columns: { venue_id: true }
        });

        if (!match) return null; // Match not found

        // 3. Query Tables
        const baseConditions = [
            eq(tablesTable.venue_id, match.venue_id),
            gte(tablesTable.capacity, partySize)
        ];

        if (accessible) {
            baseConditions.push(eq(tablesTable.is_accessible, true));
        }

        if (busyIds.length > 0) {
            baseConditions.push(notInArray(tablesTable.id, busyIds));
        }

        // 3. Sort by capacity ASC (Best Fit)
        const candidates = await db.select()
            .from(tablesTable)
            .where(and(...baseConditions))
            .orderBy(asc(tablesTable.capacity))
            .limit(1);

        return candidates[0] || null;
    }

    async createHold(userId: string, matchId: string, tableId: string, partySize: number) {
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        const [hold] = await db.insert(tableHoldsTable).values({
            user_id: userId,
            venue_match_id: matchId,
            table_id: tableId,
            party_size: partySize,
            expires_at: expiresAt
        }).returning();

        return hold;
    }

    async findHoldById(holdId: string) {
        return await db.query.tableHoldsTable.findFirst({
            where: eq(tableHoldsTable.id, holdId),
            with: {
                table: true,
                venueMatch: true
            }
        });
    }

    async deleteHold(holdId: string) {
        await db.delete(tableHoldsTable).where(eq(tableHoldsTable.id, holdId));
    }

    // Atomic "Find & Lock" to prevent race conditions
    async findAndHoldBestTable(venueMatchId: string, partySize: number, userId: string, accessible: boolean = false) {
        return await db.transaction(async (tx) => {
            // 1. Get Match (Venue ID)
            const match = await tx.query.venueMatchesTable.findFirst({
                where: eq(venueMatchesTable.id, venueMatchId),
                columns: { venue_id: true }
            });

            if (!match) return null;

            // 2. Identify Busy Tables (Confirmed or Active Holds)
            // We use subqueries or separate fetches. For simplicity/clarity in transaction, separate fetches are fine 
            // provided we rely on the final LOCK of the *candidate* table.

            // Note: If we fetch busy IDs here, there's a tiny window where someone confirms *between* fetch and lock?
            // No, because we are selecting a *Table Row*. 
            // If someone confirms Table 1, they must have held it first (locking it).
            // So checking active holds is the key.

            const reservedIds = await tx.select({ id: reservationsTable.table_id })
                .from(reservationsTable)
                .where(and(
                    eq(reservationsTable.venue_match_id, venueMatchId),
                    eq(reservationsTable.status, 'confirmed')
                ));

            const heldIds = await tx.select({ id: tableHoldsTable.table_id })
                .from(tableHoldsTable)
                .where(and(
                    eq(tableHoldsTable.venue_match_id, venueMatchId),
                    gte(tableHoldsTable.expires_at, new Date())
                ));

            const busyIds = [
                ...reservedIds.map(r => r.id),
                ...heldIds.map(h => h.id)
            ].filter(id => id !== null) as string[];

            // 3. Find Candidate with SKIP LOCKED
            // "Give me the first table that fits, is valid, and NOT locked by someone else right now"

            const baseConditions = [
                eq(tablesTable.venue_id, match.venue_id),
                gte(tablesTable.capacity, partySize)
            ];

            if (accessible) {
                baseConditions.push(eq(tablesTable.is_accessible, true));
            }

            if (busyIds.length > 0) {
                baseConditions.push(notInArray(tablesTable.id, busyIds));
            }

            // Use 'for' update skip locked
            const candidates = await tx.select()
                .from(tablesTable)
                .where(and(...baseConditions))
                .orderBy(asc(tablesTable.capacity))
                .limit(1)
                // @ts-ignore: Drizzle DSQL specific
                .for('update', { skipLocked: true });

            const table = candidates[0];

            if (!table) return null; // No available table found

            // 4. Create Hold
            const [hold] = await tx.insert(tableHoldsTable).values({
                user_id: userId,
                venue_match_id: venueMatchId,
                table_id: table.id,
                party_size: partySize,
                expires_at: new Date(Date.now() + 15 * 60 * 1000)
            }).returning();

            return { hold, table };
        });
    }
}
