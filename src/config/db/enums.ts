import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['venue_owner', 'user', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deleted']);

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

// Transaction types for venue owner billing (commission-first model)
// Users do NOT pay for reservations
export const transactionTypeEnum = pgEnum('transaction_type', [
    'commission',
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

export const referralStatusEnum = pgEnum('referral_status', ['invited', 'signed_up', 'converted']);
export const boostTypeEnum = pgEnum('boost_type', ['purchased', 'referral', 'promotional']);
export const boostStatusEnum = pgEnum('boost_status', ['available', 'used', 'expired']);

export const auditActionEnum = pgEnum('audit_action', [
    'create',
    'update',
    'delete',
    'login',
    'logout',
    'export',
]);
