# Implementation Plan: New Economic Model (Commission-Based)

This document outlines the strategy and status for transitioning the Match platform from a flat subscription model to a commission-based model (€1.15 per guest).

## 1. Objective
The goal is to align venue owner costs with the value received. Instead of a fixed monthly fee, venue owners will pay a commission for every guest who successfully checks in via the Match platform.

**Rate:** €1.15 per guest (based on `party_size` of a `checked_in` reservation).

---

## 2. Database Schema Updates

### `reservations` table
- [x] Add `is_billed` (boolean, default false): To track if this reservation has already been reported to the billing system.
- [x] Add `billed_at` (timestamp): For audit trails.
- [x] Add `commission_rate` (numeric): Snapshotted rate at the time of reservation/check-in to handle future price changes.

### `venues` table
- [x] Add `commission_override` (numeric, optional): To allow specific venues to have different rates (e.g., promotional periods).

---

## 3. Stripe Integration (Real-time Off-Session Billing)

### Mechanism
- **Validated Pattern**: Based on success in `health.logic.ts`, we use direct `PaymentIntents` with `off_session: true` and `confirm: true`.
- **Trigger**: The charge is initiated immediately when a guest is checked in.
- **Worker**: Async processing via `stripeWorker` to ensure API performance.

---

## 4. Backend Logic Implementation

### Reservations Module (`reservations.logic.ts`)
- [x] **Check-in Trigger**: When a venue owner scans a QR code and the status changes to `checked_in`.
- [x] **Queue Job**: Adds a `process_commission` job to the `stripe` queue.

### Stripe Worker (`stripe.worker.ts`)
- [x] **`handleProcessCommission`**: 
    1. Fetches the customer's default payment method.
    2. Executes an immediate `paymentIntents.create`.
    3. On success, marks reservation as `is_billed = true`.

---

## 5. Background Jobs & Workers

### Stripe Worker (Active)
- [x] Process real-time commissions.
- [x] Handle webhook events for subscription management.

### Monthly Billing Worker (Legacy/Optional)
- [ ] Implement `MONTHLY_USAGE_AGGREGATION` only if moving back to metered usage records. Currently, real-time charging is preferred for cash flow.

---

## 6. Partner Dashboard Updates (API Support)

### Analytics (`analytics.logic.ts`)
- [x] **Cost Analysis**: Added `accrued_commission` to the dashboard overview repository logic.

---

## 7. Implementation Status

### Phase 1: Tracking (DONE)
- Schema updates applied.
- Commission rates snapshotted on reservations.

### Phase 2: Stripe Integration (DONE)
- Off-session charging logic implemented in Worker.
- Queue-based triggering from check-in logic.

### Phase 3: Validation (IN PROGRESS)
- [x] Verified off-session charging in Health module.
- [ ] End-to-end production verification (QR scan -> Charge).

---

## 8. Foundational Tests (Health Module)
We have successfully validated the core Stripe mechanics in the `health` module:
- **Payment Method Verification (`testStripePaymentMethod`)**: Validated the ability to create dummy customers and redirect them to the Stripe Billing Portal to save payment methods.
- **Off-Session Charging (`testChargeCustomer`)**: Successfully simulated a €1.15 (115 cents) charge using a saved payment method with `off_session: true`. 

---

## 9. Verification Strategy
- **Integration Test**: Perform a full flow (Reservation -> Scan QR -> Check-in) and verify the Stripe PaymentIntent was created in the Stripe Dashboard.
- **Edge Case Test**: Verify that if a charge fails (e.g. card declined), we have a path to notify the venue owner (webhook listener for `payment_intent.payment_failed`).
