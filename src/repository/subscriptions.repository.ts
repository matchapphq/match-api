import { eq, desc } from 'drizzle-orm';
import { db } from '../config/config.db';
import { invoicesTable, type Invoice, type NewInvoice } from '../config/db/billing.table';
import { usersTable } from '../config/db/user.table';

type LegacySubscriptionRecord = {
    id: string;
    [key: string]: unknown;
};

/**
 * Compatibility repository for former subscription operations.
 * Commission-only model no longer persists subscriptions.
 */
export class SubscriptionsRepository {
    // ============================================
    // LEGACY SUBSCRIPTIONS (DEPRECATED COMPAT)
    // ============================================

    async createSubscription(data: Record<string, unknown>): Promise<LegacySubscriptionRecord> {
        return {
            id: `deprecated_sub_${Date.now()}`,
            ...data,
        };
    }

    async getSubscriptionByUserId(_userId: string): Promise<LegacySubscriptionRecord | null> {
        return null;
    }

    async getSubscriptionByStripeId(_stripeSubscriptionId: string): Promise<LegacySubscriptionRecord | null> {
        return null;
    }

    async getSubscriptionById(_id: string): Promise<LegacySubscriptionRecord | null> {
        return null;
    }

    async updateSubscription(_id: string, _data: Record<string, unknown>): Promise<LegacySubscriptionRecord | null> {
        return null;
    }

    async updateSubscriptionByStripeId(_stripeSubscriptionId: string, _data: Record<string, unknown>): Promise<LegacySubscriptionRecord | null> {
        return null;
    }

    async cancelSubscription(_id: string): Promise<LegacySubscriptionRecord | null> {
        return null;
    }

    async deleteSubscription(_id: string): Promise<boolean> {
        return true;
    }

    // ============================================
    // STRIPE CUSTOMER MANAGEMENT
    // ============================================

    async getStripeCustomerId(userId: string): Promise<string | null> {
        const result = await db.select({ stripe_customer_id: usersTable.stripe_customer_id })
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
        return result[0]?.stripe_customer_id || null;
    }

    async setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
        await db.update(usersTable)
            .set({ stripe_customer_id: stripeCustomerId, updated_at: new Date() })
            .where(eq(usersTable.id, userId));
    }

    async getUserById(userId: string): Promise<{ id: string; email: string } | null> {
        const result = await db.select({ id: usersTable.id, email: usersTable.email })
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
        return result[0] || null;
    }

    async getUserByStripeCustomerId(stripeCustomerId: string): Promise<{ id: string; email: string } | null> {
        const result = await db.select({ id: usersTable.id, email: usersTable.email })
            .from(usersTable)
            .where(eq(usersTable.stripe_customer_id, stripeCustomerId))
            .limit(1);
        return result[0] || null;
    }

    // ============================================
    // INVOICES
    // ============================================

    async createInvoice(data: NewInvoice & Record<string, unknown>): Promise<Invoice> {
        const values: NewInvoice = {
            user_id: data.user_id as string,
            invoice_number: data.invoice_number as string,
            status: data.status as any,
            issue_date: data.issue_date as string,
            due_date: data.due_date as string,
            paid_date: (data.paid_date as string | null | undefined) ?? null,
            subtotal: data.subtotal as string,
            tax: data.tax as string,
            total: data.total as string,
            description: (data.description as string | null | undefined) ?? null,
            items: (data.items as any) ?? null,
            pdf_url: (data.pdf_url as string | null | undefined) ?? null,
        };

        const [invoice] = await db.insert(invoicesTable)
            .values(values)
            .returning();
        return invoice!;
    }

    async getInvoicesByUserId(userId: string, limit = 10, offset = 0): Promise<Invoice[]> {
        return db.select()
            .from(invoicesTable)
            .where(eq(invoicesTable.user_id, userId))
            .orderBy(desc(invoicesTable.issue_date))
            .limit(limit)
            .offset(offset);
    }

    async getInvoiceById(id: string): Promise<Invoice | null> {
        const result = await db.select()
            .from(invoicesTable)
            .where(eq(invoicesTable.id, id))
            .limit(1);
        return result[0] || null;
    }

    async updateInvoiceStatus(id: string, status: string, paidDate?: Date): Promise<Invoice | null> {
        const [updated] = await db.update(invoicesTable)
            .set({
                status: status as any,
                paid_date: paidDate?.toISOString().split('T')[0],
                updated_at: new Date(),
            })
            .where(eq(invoicesTable.id, id))
            .returning();
        return updated || null;
    }

    async generateInvoiceNumber(): Promise<string> {
        const year = new Date().getFullYear();
        const result = await db.select()
            .from(invoicesTable)
            .orderBy(desc(invoicesTable.created_at))
            .limit(1);

        const lastNumber = result[0]?.invoice_number;
        let nextSeq = 1;

        if (lastNumber) {
            const match = lastNumber.match(/INV-(\d{4})-(\d+)/);
            if (match && match[1] && match[2] && match[1] === String(year)) {
                nextSeq = parseInt(match[2], 10) + 1;
            }
        }

        return `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
    }
}

export default new SubscriptionsRepository();
