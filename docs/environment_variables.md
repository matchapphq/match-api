# Environment Variables (Backend)

Ce document référence les variables utiles au runtime backend final.

## Variables requises (boot bloqué si absentes)
Selon `src/utils/checkEnv.ts`:

### Core
- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`

### Database
- `DATABASE_URL`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`

### Auth / Security
- `SECRET_KEY`
- `REFRESH_SECRET_KEY`
- `ACCESS_JWT_SIGN_KEY`
- `REFRESH_JWT_SIGN_KEY`
- `QR_SECRET`

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Geocoding
- `LOCATIONIQ_KEY`

### SMTP
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_SEND_MAIL`
- `SMTP_SEND_NAME`

### Storage
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`

### Redis
- `REDIS_HOST`
- `REDIS_PORT`

## Variables optionnelles/recommandées

### Auth sessions & privacy
- `SESSION_INACTIVITY_DAYS` (default logique: 7)
- `ACCOUNT_DELETION_GRACE_DAYS` (default logique: 30)
- `ACCOUNT_DELETION_CLEANUP_INTERVAL_HOURS` (default logique: 6)
- `SESSION_GEOIP_ENABLED`
- `SESSION_GEOIP_PROVIDER_URL`

### OAuth
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_IDS`
- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_ANDROID_CLIENT_ID`
- `APPLE_CLIENT_ID`
- `APPLE_CLIENT_IDS`
- `APPLE_IOS_CLIENT_ID`
- `APPLE_SERVICE_ID`

### Stripe pricing
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`

### Redis avancé
- `REDIS_URL`
- `REDIS_PASSWORD`

### Storage avancé
- `S3_REGION`
- `S3_ENDPOINT`
- `S3_PUBLIC_URL`

### Référencement / produit
- `REFERRAL_BASE_URL`
- `BOOST_VALUE`

### API Sports / seed
- `API_SPORTS_KEY`

### Mails support
- `SMTP_NO_REPLY`
- `SUPPORT_EMAIL`
- `BUG_REPORT_EMAIL`
- `DATA_EXPORT_EMAIL`

## Exemple minimal local (`.env.dev`)
```env
NODE_ENV=development
PORT=8008
FRONTEND_URL=http://localhost:5173

DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=postgres

SECRET_KEY=change-me
REFRESH_SECRET_KEY=change-me
ACCESS_JWT_SIGN_KEY=change-me
REFRESH_JWT_SIGN_KEY=change-me
QR_SECRET=change-me

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_ANNUAL=price_xxx

LOCATIONIQ_KEY=xxx

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_URL=redis://127.0.0.1:6379

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user
SMTP_PASSWORD=pass
SMTP_SEND_MAIL=noreply@matchapp.fr
SMTP_SEND_NAME=Match

S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
S3_BUCKET=match-media
S3_REGION=eu-west-3
```
