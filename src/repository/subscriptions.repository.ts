import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/config.db';
import { subscriptionsTable, type Subscription, type NewSubscription } from '../config/db/subscriptions.table';
import { invoicesTable, type Invoice, type NewInvoice } from '../config/db/billing.table';
import { usersTable } from '../config/db/user.table';

/**
 * Repository for Subscription-related database operations
 * 
 * Handles all CRUD operations for subscriptions, invoices, and Stripe customer management.
 */
export class SubscriptionsRepository {
    
    // ============================================
    // SUBSCRIPTIONS
    // ============================================

    /**
     * Create a new subscription record
     */
    async createSubscription(data: NewSubscription): Promise<Subscription> {
        const [subscription] = await db.insert(subscriptionsTable)
            .values(data)
            .returning();
        return subscription!;
    }

    /**
     * Get subscription by user ID
     */
    async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
        const result = await db.select()
            .from(subscriptionsTable)
            .where(eq(subscriptionsTable.user_id, userId))
            .limit(1);
        return result[0] || null;
    }

    /**
     * Get subscription by Stripe subscription ID
     */
    async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
        const result = await db.select()
            .from(subscriptionsTable)
            .where(eq(subscriptionsTable.stripe_subscription_id, stripeSubscriptionId))
            .limit(1);
        return result[0] || null;
    }

    /**
     * Get subscription by ID
     */
    async getSubscriptionById(id: string): Promise<Subscription | null> {
        const result = await db.select()
            .from(subscriptionsTable)
            .where(eq(subscriptionsTable.id, id))
            .limit(1);
        return result[0] || null;
    }

    /**
     * Update subscription by ID
     */
    async updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription | null> {
        const [updated] = await db.update(subscriptionsTable)
            .set({ ...data, updated_at: new Date() })
            .where(eq(subscriptionsTable.id, id))
            .returning();
        return updated || null;
    }

    /**
     * Update subscription by Stripe subscription ID
     */
    async updateSubscriptionByStripeId(stripeSubscriptionId: string, data: Partial<Subscription>): Promise<Subscription | null> {
        const [updated] = await db.update(subscriptionsTable)
            .set({ ...data, updated_at: new Date() })
            .where(eq(subscriptionsTable.stripe_subscription_id, stripeSubscriptionId))
            .returning();
        return updated || null;
    }

    /**
     * Cancel subscription (soft delete - marks as canceled)
     */
    async cancelSubscription(id: string): Promise<Subscription | null> {
        const [updated] = await db.update(subscriptionsTable)
            .set({
                status: 'canceled',
                canceled_at: new Date(),
                auto_renew: false,
                updated_at: new Date(),
            })
            .where(eq(subscriptionsTable.id, id))
            .returning();
        return updated || null;
    }

    /**
     * Delete subscription (hard delete)
     */
    async deleteSubscription(id: string): Promise<boolean> {
        const result = await db.delete(subscriptionsTable)
            .where(eq(subscriptionsTable.id, id));
        return true;
    }

    // ============================================
    // STRIPE CUSTOMER MANAGEMENT
    // ============================================

    /**
     * Get user's Stripe customer ID
     */
    async getStripeCustomerId(userId: string): Promise<string | null> {
        const result = await db.select({ stripe_customer_id: usersTable.stripe_customer_id })
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
        return result[0]?.stripe_customer_id || null;
    }

    /**
     * Set user's Stripe customer ID
     */
    async setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
        await db.update(usersTable)
            .set({ stripe_customer_id: stripeCustomerId, updated_at: new Date() })
            .where(eq(usersTable.id, userId));
    }

    /**
     * Get user by ID
     */
    async getUserById(userId: string): Promise<{ id: string; email: string } | null> {
        const result = await db.select({ id: usersTable.id, email: usersTable.email })
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
        return result[0] || null;
    }

    /**
     * Get user by Stripe customer ID
     */
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

    /**
     * Create a new invoice record
     */
    async createInvoice(data: NewInvoice): Promise<Invoice> {
        const [invoice] = await db.insert(invoicesTable)
            .values(data)
            .returning();
        return invoice!;
    }

    /**
     * Get invoices by user ID (paginated, most recent first)
     */
    async getInvoicesByUserId(userId: string, limit = 10, offset = 0): Promise<Invoice[]> {
        return db.select()
            .from(invoicesTable)
            .where(eq(invoicesTable.user_id, userId))
            .orderBy(desc(invoicesTable.issue_date))
            .limit(limit)
            .offset(offset);
    }

    /**
     * Get invoice by ID
     */
    async getInvoiceById(id: string): Promise<Invoice | null> {
        const result = await db.select()
            .from(invoicesTable)
            .where(eq(invoicesTable.id, id))
            .limit(1);
        return result[0] || null;
    }

    /**
     * Update invoice status
     */
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

    /**
     * Generate next invoice number
     */
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
