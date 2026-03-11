import { db } from "../config/config.db";
import {
    invoicesTable,
    transactionsTable,
    type Invoice,
    type NewInvoice,
    type NewTransaction,
    type Transaction,
} from "../config/db/billing.table";
import { reservationsTable } from "../config/db/reservations.table";
import { venueMatchesTable } from "../config/db/matches.table";
import { venuesTable } from "../config/db/venues.table";
import { eq, and, desc, count, sql, isNotNull } from "drizzle-orm";

export class BillingRepository {
    /**
     * Calculate unbilled commission for a venue owner.
     * Sums up party_size * commission_rate for all 'checked_in' but not 'is_billed' reservations.
     */
    async getUnbilledUsage(userId: string) {
        const result = await db.select({
            total_guests: sql<number>`SUM(${reservationsTable.party_size})::int`,
            total_commission: sql<string>`SUM(${reservationsTable.party_size} * CAST(COALESCE(${reservationsTable.commission_rate}, '1.50') AS NUMERIC))`,
        })
        .from(reservationsTable)
        .innerJoin(venueMatchesTable, eq(reservationsTable.venue_match_id, venueMatchesTable.id))
        .innerJoin(venuesTable, eq(venueMatchesTable.venue_id, venuesTable.id))
        .where(and(
            eq(venuesTable.owner_id, userId),
            eq(reservationsTable.status, 'checked_in'),
            eq(reservationsTable.is_billed, false),
        ));

        return {
            guests: result[0]?.total_guests || 0,
            amount: result[0]?.total_commission || "0.00",
        };
    }

    async getInvoices(userId: string, limit = 20, offset = 0) {
        const conditions = and(
            eq(transactionsTable.user_id, userId),
            eq(transactionsTable.type, "commission"),
            isNotNull(transactionsTable.invoice_id),
        );

        const [countRes] = await db.select({ count: count() })
            .from(transactionsTable)
            .where(conditions);

        const transactions = await db.query.transactionsTable.findMany({
            where: conditions,
            with: {
                invoice: true,
            },
            limit,
            offset,
            orderBy: desc(transactionsTable.completed_at),
        });

        const data = transactions
            .map((transaction) => transaction.invoice)
            .filter((invoice): invoice is NonNullable<typeof invoice> => Boolean(invoice));

        return {
            data,
            total: countRes?.count ?? 0,
        };
    }

    async getInvoiceById(invoiceId: string, userId: string) {
        const commissionTransaction = await db.query.transactionsTable.findFirst({
            where: and(
                eq(transactionsTable.invoice_id, invoiceId),
                eq(transactionsTable.user_id, userId),
                eq(transactionsTable.type, "commission"),
            ),
        });

        if (!commissionTransaction) {
            return null;
        }

        return await db.query.invoicesTable.findFirst({
            where: and(
                eq(invoicesTable.id, invoiceId),
                eq(invoicesTable.user_id, userId),
            ),
        });
    }

    async getTransactions(userId: string, limit = 20, offset = 0) {
        const conditions = and(
            eq(transactionsTable.user_id, userId),
            eq(transactionsTable.type, "commission"),
        );

        const [countRes] = await db.select({ count: count() })
            .from(transactionsTable)
            .where(conditions);

        const data = await db.query.transactionsTable.findMany({
            where: conditions,
            limit,
            offset,
            orderBy: desc(transactionsTable.created_at),
        });

        return {
            data,
            total: countRes?.count ?? 0,
        };
    }

    async getTransactionById(transactionId: string, userId: string) {
        return await db.query.transactionsTable.findFirst({
            where: and(
                eq(transactionsTable.id, transactionId),
                eq(transactionsTable.user_id, userId),
                eq(transactionsTable.type, "commission"),
            ),
        });
    }

    async getTransactionByStripeTransactionId(stripeTransactionId: string) {
        return await db.query.transactionsTable.findFirst({
            where: eq(transactionsTable.stripe_transaction_id, stripeTransactionId),
        });
    }

    async createTransaction(data: NewTransaction): Promise<Transaction> {
        const [transaction] = await db.insert(transactionsTable)
            .values(data)
            .returning();
        return transaction!;
    }

    async updateTransaction(transactionId: string, data: Partial<Transaction>): Promise<Transaction | null> {
        const [updated] = await db.update(transactionsTable)
            .set({
                ...data,
                updated_at: new Date(),
            })
            .where(eq(transactionsTable.id, transactionId))
            .returning();
        return updated || null;
    }

    async attachInvoiceToTransaction(transactionId: string, invoiceId: string): Promise<Transaction | null> {
        return this.updateTransaction(transactionId, { invoice_id: invoiceId });
    }

    async getInvoiceByNumber(invoiceNumber: string) {
        return await db.query.invoicesTable.findFirst({
            where: eq(invoicesTable.invoice_number, invoiceNumber),
        });
    }

    async createInvoice(data: NewInvoice): Promise<Invoice> {
        const [invoice] = await db.insert(invoicesTable)
            .values(data)
            .returning();
        return invoice!;
    }

    async updateInvoicePdfUrl(invoiceId: string, pdfUrl: string): Promise<Invoice | null> {
        const [updated] = await db.update(invoicesTable)
            .set({
                pdf_url: pdfUrl,
                updated_at: new Date(),
            })
            .where(eq(invoicesTable.id, invoiceId))
            .returning();

        return updated || null;
    }

    async getCommissionTransactionsWithInvoices(userId: string, limit = 200) {
        return await db.query.transactionsTable.findMany({
            where: and(
                eq(transactionsTable.user_id, userId),
                eq(transactionsTable.type, "commission"),
                isNotNull(transactionsTable.invoice_id),
            ),
            with: {
                invoice: true,
            },
            limit,
            orderBy: desc(transactionsTable.completed_at),
        });
    }
}
