import { pgTable, varchar, numeric, boolean, timestamp, uuid, index, foreignKey, integer, text, date, jsonb } from 'drizzle-orm/pg-core';
import { usersTable } from './user.table';
import { paymentMethodTypeEnum, invoiceStatusEnum, transactionTypeEnum, transactionStatusEnum } from './enums';
import { reservationsTable } from './reservations.table';
import { subscriptionsTable } from './subscriptions.table';

// ============================================
// BILLING TABLES - FOR VENUE OWNERS ONLY
// These tables handle subscription payments for venue owners.
// Regular users do NOT pay - reservations are completely free.
// ============================================

// ============================================
// TYPES
// ============================================

export interface InvoiceItem {
    id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    tax_rate?: number;
    tax_amount?: number;
}

export type InvoiceItems = InvoiceItem[];

// ============================================
// 21. PAYMENT METHODS TABLE
// ============================================

export const paymentMethodsTable = pgTable(
    'payment_methods',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),

        type: paymentMethodTypeEnum('type').notNull(),

        // Card details (encrypted in practice)
        card_number: varchar('card_number', { length: 255 }),
        card_holder_name: varchar('card_holder_name', { length: 255 }),
        expiry_month: integer('expiry_month'),
        expiry_year: integer('expiry_year'),

        // PayPal / Apple Pay / Google Pay
        external_id: varchar('external_id', { length: 255 }),

        is_default: boolean('is_default').default(false),
        is_active: boolean('is_active').default(true),

        // Stripe
        stripe_payment_method_id: varchar('stripe_payment_method_id', { length: 255 }).unique(),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_payment_methods_user_id').on(table.user_id),
        index('idx_payment_methods_type').on(table.type),
        index('idx_payment_methods_is_default').on(table.is_default),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_payment_methods_user_id',
        }).onDelete('cascade'),
    ]
);

export type PaymentMethod = typeof paymentMethodsTable.$inferSelect;
export type NewPaymentMethod = typeof paymentMethodsTable.$inferInsert;

// ============================================
// 22. INVOICES TABLE
// ============================================

export const invoicesTable = pgTable(
    'invoices',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),

        invoice_number: varchar('invoice_number', { length: 50 }).notNull().unique(),
        status: invoiceStatusEnum('status').default('draft').notNull(),

        // Dates
        issue_date: date('issue_date').notNull(),
        due_date: date('due_date').notNull(),
        paid_date: date('paid_date'),

        // Amounts
        subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
        tax: numeric('tax', { precision: 12, scale: 2 }).default('0.00'),
        total: numeric('total', { precision: 12, scale: 2 }).notNull(),

        // Description
        description: text('description'),
        items: jsonb('items').$type<InvoiceItems>(),

        // PDF
        pdf_url: text('pdf_url'),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_invoices_user_id').on(table.user_id),
        index('idx_invoices_status').on(table.status),
        index('idx_invoices_issue_date').on(table.issue_date),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_invoices_user_id',
        }).onDelete('cascade'),
    ]
);

export type Invoice = typeof invoicesTable.$inferSelect;
export type NewInvoice = typeof invoicesTable.$inferInsert;

// ============================================
// 23. TRANSACTIONS TABLE
// ============================================

export const transactionsTable = pgTable(
    'transactions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        user_id: uuid('user_id').notNull(),

        type: transactionTypeEnum('type').notNull(),
        status: transactionStatusEnum('status').default('pending').notNull(),

        // Amount
        amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
        currency: varchar('currency', { length: 3 }).default('EUR'),

        // Related entities (subscriptions only - users don't pay for reservations)
        subscription_id: uuid('subscription_id'),
        invoice_id: uuid('invoice_id'),

        // Payment
        payment_method_id: uuid('payment_method_id'),
        stripe_transaction_id: varchar('stripe_transaction_id', { length: 255 }).unique(),

        // Details
        description: varchar('description', { length: 255 }),
        notes: text('notes'),

        completed_at: timestamp('completed_at', { withTimezone: true }),
        failed_reason: varchar('failed_reason', { length: 255 }),

        created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('idx_transactions_user_id').on(table.user_id),
        index('idx_transactions_type').on(table.type),
        index('idx_transactions_status').on(table.status),
        index('idx_transactions_created_at').on(table.created_at),
        foreignKey({
            columns: [table.user_id],
            foreignColumns: [usersTable.id],
            name: 'fk_transactions_user_id',
        }).onDelete('cascade'),
    ]
);

export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;

