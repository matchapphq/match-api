# QA Runbook — Commission-Only Billing

Date reference: this runbook targets the commission-only model active in March 2026.

## Preconditions
- Stripe test mode configured (`STRIPE_SECRET_KEY`, webhook signing secret).
- At least one `venue_owner` test account.
- Webhook endpoint active for Stripe events.
- Billing worker and Stripe worker running.

## Scenario 1 — First venue without payment method
1. Login as a new `venue_owner` with no `stripe_customer_id`.
2. Call `POST /api/partners/venues` with valid venue payload.
3. Verify response:
   - `is_first_venue: true`
   - `requires_payment_setup: true`
   - `payment_setup_flow: "post_first_venue"`
4. Verify DB venue state:
   - `is_active = false`
   - `status = "pending"`

Expected: venue is created but inactive until Stripe setup is completed.

## Scenario 2 — Payment setup success activates pending venue(s)
1. From same owner account, call `POST /api/billing/setup-checkout` with `flow=post_first_venue`.
2. Complete Stripe Checkout in `mode=setup`.
3. Verify webhook `checkout.session.completed` (`mode=setup`) is received.
4. Verify owner now has `stripe_customer_id`.
5. Verify pending venue(s) became:
   - `is_active = true`
   - `status = "approved"`

Expected: onboarding completion automatically activates all pending venues for this owner.

## Scenario 3 — Check-in then monthly charge creates transaction + invoice
1. Create confirmed reservation for an active venue, then call check-in endpoint.
2. Verify reservation becomes `checked_in` and remains `is_billed = false` (accrued).
3. Trigger monthly billing run (last day of month flow) in test:
   - either run on month-end schedule,
   - or manually enqueue/run `MONTHLY_USAGE_AGGREGATION`.
4. Verify on successful Stripe payment:
   - commission transaction exists (`type = "commission"`, `status = "completed"`),
   - commission invoice exists and is linked to transaction,
   - reservation(s) included in the batch become `is_billed = true`.
5. Verify read endpoints:
   - `GET /api/transactions`
   - `GET /api/invoices`
   - `GET /api/partners/venues/:venueId/invoices`

Expected: billing data is visible from API and sourced from local commission transaction/invoice records.

## Scenario 4 — Block venue operations when no payment method / inactive venue
1. Use owner with inactive/pending venue (or remove payment setup before activation in fresh test flow).
2. Attempt venue operations:
   - schedule match,
   - update/cancel match,
   - QR verify/check-in actions.
3. Verify response is `403` with:
   - `error = "VENUE_INACTIVE_PAYMENT_REQUIRED"`.

Expected: central business guard prevents operating inactive venues.

## Scenario 5 — Legacy subscription endpoints are deprecated
Call each endpoint and verify `410 Gone` + explicit commission-only message:
- `GET /api/subscriptions/plans`
- `POST /api/subscriptions/create-checkout`
- `GET /api/subscriptions/me`
- `POST /api/subscriptions/me/cancel`
- `POST /api/subscriptions/me/upgrade`
- `GET /api/subscriptions/invoices`

Expected: each returns:
- `error = "ENDPOINT_DEPRECATED"`
- message indicating commission-only model
- `replacement` route hint.
