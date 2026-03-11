[🏠 Home](./index.md) | [🏗️ Architecture](./architecture.md) | [🔌 API Routes](./api_routes.md) | [📊 Status](./status_report.md)

---

# Stripe Integration Documentation

## Overview

This document describes the Stripe subscription integration for the Match platform. The integration handles subscription management for venue owners (restaurateurs) who pay a monthly or annual fee to use the platform.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API   │────▶│    Stripe       │
│  (React/Vite)   │     │   (Hono/Bun)    │     │    API          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               │                        │
                               ▼                        │
                        ┌─────────────────┐            │
                        │   PostgreSQL    │◀───────────┘
                        │   (Neon)        │    Webhooks
                        └─────────────────┘
```

## Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...          # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...        # Webhook signing secret
STRIPE_PRICE_MONTHLY=price_...         # Monthly plan Price ID
STRIPE_PRICE_ANNUAL=price_...          # Annual plan Price ID

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:5173     # Or your production URL
```

## Stripe Dashboard Setup

### 1. Create Products & Prices

In Stripe Dashboard → Products:

1. **Create Product: "Match Subscription"**
   
2. **Create Price: Monthly**
   - Amount: €30.00
   - Billing period: Monthly
   - Copy the Price ID → `STRIPE_PRICE_MONTHLY`

3. **Create Price: Annual**
   - Amount: €300.00
   - Billing period: Yearly
   - Copy the Price ID → `STRIPE_PRICE_ANNUAL`

### 2. Configure Webhook

In Stripe Dashboard → Developers → Webhooks:

1. **Add endpoint:**
   - URL: `https://your-api-domain.com/webhooks/stripe`
   - Events to listen:
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

2. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 3. Configure Customer Portal

In Stripe Dashboard → Settings → Billing → Customer portal:

1. Enable the customer portal
2. Configure allowed actions (update payment method)

## API Endpoints

### Commission Billing (Current)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/billing/pricing` | No | Get commission pricing model |
| POST | `/billing/setup-checkout` | Yes | Create Stripe Checkout setup session (save card/SEPA, no charge) |
| GET | `/billing/payment-method` | Yes | Get payment method status (Stripe) |
| POST | `/subscriptions/me/update-payment-method` | Yes | Get Stripe Customer Portal URL |
| GET | `/invoices` | Yes | List commission invoices |
| GET | `/transactions` | Yes | List commission transactions |
| GET | `/accrued-commission` | Yes | Preview unbilled accrued commission |
| POST | `/subscriptions/mock` | Yes | Toggle mock subscription (dev only) |

### Legacy Subscription Endpoints (Deprecated)

The following endpoints now return `410 Gone` with an explicit commission-only message:
- `GET /subscriptions/plans`
- `POST /subscriptions/create-checkout`
- `GET /subscriptions/me`
- `POST /subscriptions/me/cancel`
- `POST /subscriptions/me/upgrade`
- `GET /subscriptions/invoices`

### Webhooks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/webhooks/stripe` | Signature | Handle Stripe webhook events |

## Commission Flow

### Payment Method Setup (No Charge)

```
1. Frontend calls POST /billing/setup-checkout
2. Backend creates Stripe Checkout Session in mode=setup
3. User saves card/SEPA in Stripe Checkout
4. Stripe sends checkout.session.completed (setup)
5. Backend stores stripe_customer_id and activates pending venues
```

### Monthly Commission Collection (Month End)

```
1. Monthly job runs at end of month (last day guard in service)
2. Backend aggregates unbilled checked-in reservations per owner
3. Backend creates one off-session PaymentIntent per owner (monthly total)
4. Backend records idempotent commission transaction
5. On success, backend creates commission invoice and marks reservations billed
6. On failure, backend records failed transaction with reason
```

### Economic Models

### Commission-Based Billing (Pay-per-Guest)
As of March 2026, subscription billing is deprecated in favor of commission-only.
- **Rate:** €1.50 per guest check-in.
- **Trigger:** Guest status `checked_in`, then collected by monthly job.
- **Mechanism:** One monthly off-session `PaymentIntent` per owner (aggregated amount), plus local commission transaction + invoice.

---

## ⚡ Asynchronous Payment Handling (SEPA & Delayed Methods)

Since some payment methods like **SEPA Direct Debit** are not instant, the system uses a dual-layer confirmation pattern to ensure data integrity.

### The "Monthly Job + Webhook" Handshake
1. **Monthly Job (Initiator):** Creates the monthly commission `PaymentIntent` and records an idempotent pending transaction.
2. **Webhook (Confirmer):** Stripe sends `payment_intent.succeeded` or `payment_intent.payment_failed`.
3. **Handler:** Updates transaction state idempotently, creates invoice on success, and marks reservation set as billed only after successful payment.

### Required Webhook Events
To support this flow, ensure your Stripe Webhook endpoint is listening for:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

---

## Commission Billing Flow (Month End)

```
1. Guest arrives at venue and presents QR code.
2. Owner scans QR -> Calls POST /api/partners/reservations/:id/check-in.
3. Backend marks reservation as 'checked_in'.
4. Reservation stays accrued (`is_billed=false`) until monthly billing.
5. End-of-month job aggregates all accrued check-ins per venue owner.
6. Backend creates one off-session PaymentIntent per owner for the monthly total.
7. On success, backend stores commission transaction + invoice and marks reservations billed.
8. On failure, backend stores failed commission transaction with reason.
```

---

## Technical Details

### Usage Reporting (Monthly Aggregation)
This implementation uses **monthly off-session charging** with idempotent transaction/invoice persistence:
- **`off_session: true`**: Tells Stripe the customer is not in the checkout flow.
- **`confirm: true`**: Attempts capture immediately when monthly job runs.
- **Idempotency key**: One key per owner + billing period.

### Environment Variables
No new variables required, but `STRIPE_SECRET_KEY` must have permission to create `PaymentIntents`.

---

## Webhook Events

| Event | Handler Action |
|-------|---------------|
| `checkout.session.completed` (`mode=setup`) | Save `stripe_customer_id`, activate pending venues |
| `payment_intent.succeeded` (`monthly_commission` / `guest_commission`) | Mark commission transaction completed, create invoice, mark reservations billed |
| `payment_intent.payment_failed` (`monthly_commission` / `guest_commission`) | Mark commission transaction failed with reason |

## Database Schema

### subscriptions table

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  plan subscription_plan NOT NULL, -- 'basic', 'pro', 'enterprise', 'trial'
  status subscription_status NOT NULL, -- 'trialing', 'active', 'past_due', 'canceled'
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_payment_method_id VARCHAR(255) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  auto_renew BOOLEAN DEFAULT TRUE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### users table (Stripe fields)

```sql
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);
```

## Files Structure

### Backend

```
src/
├── config/
│   └── stripe.ts              # Stripe client & configuration
├── controllers/
│   ├── subscriptions/
│   │   └── subscriptions.controller.ts  # Subscription endpoints
│   └── webhooks/
│       └── webhooks.controller.ts       # Webhook handlers
├── repository/
│   └── subscriptions.repository.ts      # Database operations
└── services/
    ├── subscriptions/
    │   └── subscriptions.service.ts     # Route definitions
    └── webhooks/
        └── webhooks.service.ts          # Webhook route
```

### Frontend

```
src/
├── components/
│   ├── Facturation.tsx                  # Plan selection (Stripe Checkout)
│   └── compte/
│       └── CompteFacturation.tsx        # Subscription management
├── services/
│   └── api.ts                           # API client with subscription methods
└── App.tsx                              # Checkout redirect handling
```

## Testing

### Test Cards

Use these Stripe test cards:

| Card Number | Scenario |
|------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Card declined |
| 4000 0000 0000 9995 | Insufficient funds |

### Local Webhook Testing

Use Stripe CLI to forward webhooks locally:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/webhooks/stripe

# Copy the webhook signing secret and set STRIPE_WEBHOOK_SECRET
```

### Mock Subscription (Development)

For testing without Stripe:

```bash
# Activate mock subscription
curl -X POST http://localhost:3000/subscriptions/mock \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=..." \
  -d '{"status": "active"}'

# Deactivate mock subscription
curl -X POST http://localhost:3000/subscriptions/mock \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=..." \
  -d '{"status": "inactive"}'
```

## Security Considerations

1. **Never log or expose Stripe secret keys**
2. **Always verify webhook signatures** before processing
3. **Use HTTPS in production** for all API calls
4. **Store only Stripe IDs**, never card details
5. **Handle webhooks idempotently** (same event may be sent multiple times)

## Troubleshooting

### Common Issues

1. **"Payment system not configured"**
   - Check that all Stripe environment variables are set
   - Restart the API server after setting env vars

2. **Webhook signature verification failed**
   - Ensure `STRIPE_WEBHOOK_SECRET` matches your endpoint's secret
   - Use raw body for signature verification (not parsed JSON)

3. **Checkout redirect not working**
   - Check `FRONTEND_URL` is set correctly
   - Ensure Stripe Checkout URLs are properly configured

4. **Customer portal not opening**
   - Enable Customer Portal in Stripe Dashboard
   - Configure allowed actions in portal settings

## Plan Mapping

| Frontend | Backend Plan | Stripe Price |
|----------|--------------|--------------|
| `mensuel` | `basic` | `STRIPE_PRICE_MONTHLY` |
| `annuel` | `pro` | `STRIPE_PRICE_ANNUAL` |


---
[« Back to Documentation Index](./index.md)
