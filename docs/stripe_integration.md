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
2. Configure allowed actions (update payment method, cancel subscription, etc.)

## API Endpoints

### Subscriptions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/subscriptions/plans` | No | Get available subscription plans |
| POST | `/subscriptions/create-checkout` | Yes | Create Stripe Checkout session |
| GET | `/subscriptions/me` | Yes | Get current user's subscription |
| POST | `/subscriptions/me/update-payment-method` | Yes | Get Stripe Customer Portal URL |
| POST | `/subscriptions/me/cancel` | Yes | Cancel subscription (at period end) |
| POST | `/subscriptions/me/upgrade` | Yes | Change subscription plan |
| POST | `/subscriptions/mock` | Yes | Toggle mock subscription (dev only) |

### Webhooks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/webhooks/stripe` | Signature | Handle Stripe webhook events |

## Subscription Flow

### New Subscription (Onboarding)

```
1. User selects plan in Facturation.tsx
2. Frontend calls POST /subscriptions/create-checkout
3. Backend creates Stripe Customer (if needed)
4. Backend creates Stripe Checkout Session
5. User redirected to Stripe Checkout
6. User completes payment on Stripe
7. Stripe sends checkout.session.completed webhook
8. Backend creates subscription record in DB
9. User redirected to success URL
10. Frontend detects ?checkout=success and shows dashboard
```

### Subscription Management

```
Update Payment Method:
1. User clicks "Modifier" in CompteFacturation
2. Frontend calls POST /subscriptions/me/update-payment-method
3. Backend creates Stripe Customer Portal session
4. User redirected to Stripe Portal
5. User updates payment method
6. Stripe sends customer.subscription.updated webhook (if needed)
7. User redirected back to app

Cancel Subscription:
1. User clicks "Résilier" in CompteFacturation
2. Frontend shows confirmation dialog
3. Frontend calls POST /subscriptions/me/cancel
4. Backend calls Stripe API to cancel at period end
5. Backend updates local subscription record
6. User retains access until current_period_end
```

### Webhook Events

| Event | Handler Action |
|-------|---------------|
| `checkout.session.completed` | Create subscription in DB |
| `invoice.paid` | Update subscription period, create invoice record |
| `invoice.payment_failed` | Mark subscription as `past_due` |
| `customer.subscription.updated` | Sync subscription status and period |
| `customer.subscription.deleted` | Mark subscription as `canceled` |

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
