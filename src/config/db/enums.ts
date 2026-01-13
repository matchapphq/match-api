import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['venue_owner', 'user', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deleted']);

export const subscriptionPlanEnum = pgEnum('subscription_plan', ['basic', 'pro', 'enterprise', 'trial']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['trialing', 'active', 'past_due', 'canceled']);

export const venueTypeEnum = pgEnum('venue_type', [
    'bar',
    'restaurant',
    'fast_food',
    'nightclub',
    'cafe',
    'lounge',
    'pub',
    'sports_bar',
]);
export const venueStatusEnum = pgEnum('venue_status', ['pending', 'approved', 'rejected', 'suspended']);
export const subscriptionLevelEnum = pgEnum('subscription_level', ['basic', 'pro', 'enterprise']);
export const bookingModeEnum = pgEnum('booking_mode', ['INSTANT', 'REQUEST']);

export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'live', 'finished', 'canceled', 'postponed']);

// DEPRECATED: Pricing type enum - no longer used as reservations are free for users
// Kept for backwards compatibility with existing migrations
export const venuePricingTypeEnum = pgEnum('pricing_type', ['per_seat', 'per_table', 'fixed']);

export const seatTypeEnum = pgEnum('seat_type', ['standard', 'premium', 'vip', 'wheelchair', 'couple']);
export const seatStatusEnum = pgEnum('seat_status', ['available', 'reserved', 'blocked', 'occupied', 'held']);

export const reservationStatusEnum = pgEnum('reservation_status', [
    'pending',
    'confirmed',
    'checked_in',
    'completed',
    'canceled',
    'no_show',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
    'reservation_confirmed',
    'reservation_reminder',
    'match_starting',
    'review_response',
    'subscription_expiring',
    'payment_failed',
    'promotional',
    'system',
    'match_nearby',
    'venue_nearby',
    'reservation_canceled',
]);

export const messageTypeEnum = pgEnum('message_type', ['text', 'image', 'file', 'system']);

export const paymentMethodTypeEnum = pgEnum('payment_method_type', [
    'credit_card',
    'debit_card',
    'paypal',
    'apple_pay',
    'google_pay',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
    'draft',
    'sent',
    'paid',
    'partial',
    'overdue',
    'canceled',
]);

// Transaction types - only for venue owner billing (subscriptions)
// Users do NOT pay for reservations
export const transactionTypeEnum = pgEnum('transaction_type', [
    'subscription',
    'refund',
    'payout',
    'adjustment',
]);
export const transactionStatusEnum = pgEnum('transaction_status', [
    'pending',
    'completed',
    'failed',
    'refunded',
]);

export const couponTypeEnum = pgEnum('coupon_type', ['percentage', 'fixed']);

export const auditActionEnum = pgEnum('audit_action', [
    'create',
    'update',
    'delete',
    'login',
    'logout',
    'export',
]);
