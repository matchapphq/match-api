import { db } from "../config/config.db";
import { invoicesTable, transactionsTable } from "../config/db/billing.table";
import { eq, and, desc, count } from "drizzle-orm";

export class BillingRepository {
    async getInvoices(userId: string, limit = 20, offset = 0) {
        const conditions = eq(invoicesTable.user_id, userId);
        
        const [countRes] = await db.select({ count: count() })
            .from(invoicesTable)
            .where(conditions);

        const data = await db.query.invoicesTable.findMany({
            where: conditions,
            limit,
            offset,
            orderBy: desc(invoicesTable.issue_date),
        });

        return {
            data,
            total: countRes?.count ?? 0,
        };
    }

    async getInvoiceById(invoiceId: string, userId: string) {
        return await db.query.invoicesTable.findFirst({
            where: and(
                eq(invoicesTable.id, invoiceId),
                eq(invoicesTable.user_id, userId),
            ),
        });
    }

    async getTransactions(userId: string, limit = 20, offset = 0) {
        const conditions = eq(transactionsTable.user_id, userId);

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
            ),
        });
    }
}
