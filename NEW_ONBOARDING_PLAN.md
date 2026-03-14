# Implementation Plan: Venue Owner Onboarding Refactor (Payment Method Only)

This document outlines the strategy for migrating the venue owner onboarding flow from the obsolete "Subscription-based" model to the new "Commission-based" model. Venue owners will no longer select a subscription plan. Instead, they will securely add a payment method to complete their registration and access the dashboard.

## 1. Objective
To streamline the onboarding process for venue owners by removing the friction of subscription plans. To access the dashboard, venue owners simply need to attach a valid payment method to their account via Stripe (used later for the €1.50 commission per guest check-in). If an owner does not have a registered Stripe Customer ID with a saved payment method, their onboarding is considered incomplete.

---

## 2. New Onboarding Flow

1. **Registration:** The venue owner creates an account (`POST /api/auth/register` with `role: venue_owner`).
2. **Onboarding Guard:** The frontend redirects the user to an "Add Payment Method" screen because they lack a valid Stripe Customer ID / Payment Method.
3. **Stripe Setup:** The frontend requests a Stripe Checkout Session (Setup mode) or a SetupIntent from the backend.
4. **Card Addition:** The user enters their card details securely via Stripe.
5. **Completion:** Stripe triggers a webhook (`setup_intent.setup_failed` / `checkout.session.completed`). The backend saves the `stripe_customer_id` on the user profile.
6. **Dashboard Access:** The frontend verifies the presence of the payment method and grants access to the main dashboard.

---

## 3. Backend Implementation Steps

### A. Update `Subscriptions` Module -> `Payment Setup`
Since subscriptions are obsolete, the endpoints for creating checkouts must be adapted:
- **Change `POST /api/subscriptions/create-checkout`:**
  - Instead of `mode: 'subscription'`, the Stripe Checkout session should use `mode: 'setup'`.
  - This allows Stripe to collect and save the card details to a Customer without charging an initial amount.
  - Return the `checkout_url` to the frontend.

### B. User / Auth Logic Updates
- **`GET /api/users/me`:** Ensure the response clearly indicates if the user has completed onboarding.
  - Add a derived boolean flag: `has_payment_method: !!user.stripe_customer_id`.
  - The frontend will use this flag to lock/unlock the dashboard.

### C. Webhook Handler Updates (`webhooks.logic.ts`)
- **Listen for `checkout.session.completed` (Setup Mode):**
  - Extract the `customer` ID and the `setup_intent`.
  - Save the `stripe_customer_id` to the `users` table.
  - (Optional) Retrieve the `default_payment_method` from the SetupIntent and store a reference if needed, though having the `stripe_customer_id` is sufficient for off-session charges.

### D. Venue Creation Logic (`partner.logic.ts`)
- **Remove Subscription Dependency:** 
  - `POST /api/partners/venues` currently expects a `subscription_id` or creates one.
  - **Schema Update:** Make `subscription_id` on the `venues` table nullable, or remove the column entirely since subscriptions are deprecated.
  - Venue creation should simply link the venue to the `owner_id`.
  - Ensure venue creation is only allowed if the user has a `stripe_customer_id`.

---

## 4. Database Schema Changes

### `venues` Table
- [ ] Alter `subscription_id`: Drop `NOT NULL` constraint or remove the column entirely.
- [ ] Alter `subscription_status` / `subscription_level`: Deprecate or remove.

### `subscriptions` Table
- [ ] Deprecate this table. Existing records can be kept for historical audit, but no new records should be created.

### `users` Table
- [ ] Ensure `stripe_customer_id` is reliable. It will become the primary source of truth for "completed onboarding".

---

## 5. Frontend Integration Strategy

### Routing & Guards
- Implement a route guard `RequirePaymentMethod`.
- If `user.role === 'venue_owner'` and `!user.stripe_customer_id` (or equivalent flag), redirect to `/onboarding/payment`.

### Payment Screen
- Display a clear message explaining the commission model: *"L'inscription est gratuite. Ajoutez une carte pour activer votre compte. Vous ne serez facturé que 1,50€ par client ayant honoré sa réservation."*
- Button "Ajouter une carte" -> calls the backend to get the Stripe Setup Checkout URL -> redirects to Stripe.

### Success Redirect
- After Stripe, redirect back to `/onboarding/success`.
- Poll `GET /api/users/me` until `stripe_customer_id` is populated (or rely on the session completion sync).
- Redirect to `/dashboard`.

---

## 6. Execution Phases

### Phase 1: API Setup Mode & DB Adjustments
- Update database schema (`venues` table changes).
- Create the new `POST /api/billing/setup-checkout` endpoint (replacing subscription checkout).
- Update the Stripe Webhook handler to process setup sessions and attach the customer ID to the user.

### Phase 2: Decouple Venues from Subscriptions
- Refactor `PartnerLogic.createVenue` to not require or create a subscription.
- Ensure all queries relying on `venues.subscription_id` are updated or removed.

### Phase 3: Frontend Guards & Removal of Old Code
- Clean up unused subscription endpoints (`/api/subscriptions/plans`, `/api/subscriptions/me`, etc.).
- Delete old Stripe billing logic related to fixed plans.

---

## 7. Migration of Existing Users
For existing venue owners who already have a subscription:
1. Identify owners with an active Stripe Customer ID from their old subscriptions.
2. Backfill `users.stripe_customer_id` if it's missing but present on the `subscriptions` table.
3. Cancel their active Stripe Subscriptions via the API so they are no longer billed the flat fee, seamlessly moving them to the commission model.