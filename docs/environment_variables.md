[🏠 Home](./index.md) | [🏗️ Architecture](./architecture.md) | [🔌 API Routes](./api_routes.md) | [📊 Status](./status_report.md)

---

# Environment Variables Reference

This document lists all environment variables required to run the Match API.

## 🛠️ Core Configuration

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment | `development` or `production` |
| `PORT` | API Port | `8008` |
| `FRONTEND_URL` | URL of the React dashboard | `https://matchapp.fr` |

## 🗄️ Database (PostgreSQL + PostGIS)

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | Full connection string (Neon or local) |
| `DATABASE_HOST` | Database hostname |
| `DATABASE_PORT` | Database port (Default: 5432) |
| `DATABASE_USER` | Database username |
| `DATABASE_PASSWORD` | Database password |
| `DATABASE_NAME` | Database name |

## 🔐 Security & Auth

| Variable | Description |
| :--- | :--- |
| `SECRET_KEY` | Key for signing Access JWTs |
| `REFRESH_SECRET_KEY` | Key for signing Refresh JWTs |
| `ACCESS_JWT_SIGN_KEY` | Signed cookie key for Access tokens |
| `REFRESH_JWT_SIGN_KEY` | Signed cookie key for Refresh tokens |
| `SESSION_INACTIVITY_DAYS` | Max inactivity window before a session is auto-revoked (default: `7`) |
| `ACCOUNT_DELETION_GRACE_DAYS` | Soft-delete grace period before permanent account purge (default: `30`) |
| `ACCOUNT_DELETION_CLEANUP_INTERVAL_HOURS` | Interval between deleted-account purge runs (default: `6`) |
| `QR_SECRET` | Secret for HMAC-signing reservation QRs |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (primary audience accepted for `POST /auth/google`) |
| `GOOGLE_CLIENT_IDS` | Optional comma-separated list of additional accepted Google client IDs (web/ios/android) |
| `APPLE_CLIENT_ID` | Apple OAuth audience (Bundle ID or Service ID accepted for `POST /auth/apple`) |
| `APPLE_CLIENT_IDS` | Optional comma-separated list of additional Apple audiences (e.g. iOS Bundle ID + Service ID) |

## 💳 Stripe Integration

| Variable | Description |
| :--- | :--- |
| `STRIPE_SECRET_KEY` | Stripe API Secret (sk_test_...) |
| `STRIPE_PUBLISHABLE_KEY`| Stripe Public Key (pk_test_...) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (whsec_...) |
| `STRIPE_PRICE_MONTHLY` | Price ID for Monthly Plan |
| `STRIPE_PRICE_ANNUAL` | Price ID for Annual Plan |

## 📧 Mail (SMTP)

| Variable | Description |
| :--- | :--- |
| `SMTP_HOST` | SMTP server address |
| `SMTP_PORT` | SMTP port (e.g., 587 or 465) |
| `SMTP_SECURE` | Use SSL/TLS (`true` or `false`) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `SMTP_SEND_MAIL` | Default "from" email address |
| `SMTP_SEND_NAME` | Default "from" name |
| `SMTP_NO_REPLY` | Optional override for the SMTP sender address used as the visible `from` |
| `SUPPORT_EMAIL` | Reply-to mailbox used for all outgoing emails (default: `support@matchapp.fr`) |
| `BUG_REPORT_EMAIL` | Destination mailbox for bug reports (default: `dev@matchapp.fr`) |
| `DATA_EXPORT_EMAIL` | Destination mailbox for GDPR export requests (default: `data@matchapp.fr`) |

## 📍 Services

| Variable | Description |
| :--- | :--- |
| `REDIS_URL` | Redis connection for BullMQ |
| `LOCATIONIQ_KEY` | API Key for Geocoding (Address to Lat/Lng) |
| `SESSION_GEOIP_ENABLED` | Enable server-side IP-to-location fallback when proxy geo headers are missing (default: enabled unless set to `false`) |
| `SESSION_GEOIP_PROVIDER_URL` | Optional single GeoIP provider template using `{ip}` placeholder |

## 🧾 Account Deactivation Notes

- `ACCOUNT_DELETION_GRACE_DAYS` is the source of truth for:
  - API responses from `GET/PUT /api/users/me/privacy-preferences`
  - account-deactivation emails
  - web/mobile account-deactivation UI copy
- Clients do not define this value locally. Change it in the backend env and restart the API.

## 📁 Media Storage (S3 / Cloudflare R2)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `S3_ACCESS_KEY_ID` | S3 Access Key | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | S3 Secret Key | `secret...` |
| `S3_BUCKET` | S3 Bucket Name | `match-media` |
| `S3_REGION` | S3 Region (default: us-east-1) | `eu-west-3` |
| `S3_ENDPOINT` | Optional custom endpoint (for R2/Minio) | `https://<id>.r2.cloudflarestorage.com` |
| `S3_PUBLIC_URL` | Optional custom public URL / CDN | `https://cdn.matchapp.fr` |

## 📁 Media Storage (S3 / Cloudflare R2)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `S3_ACCESS_KEY_ID` | S3 Access Key | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | S3 Secret Key | `secret...` |
| `S3_BUCKET` | S3 Bucket Name | `match-media` |
| `S3_REGION` | S3 Region (default: us-east-1) | `eu-west-3` |
| `S3_ENDPOINT` | Optional custom endpoint (for R2/Minio) | `https://<id>.r2.cloudflarestorage.com` |
| `S3_PUBLIC_URL` | Optional custom public URL / CDN | `https://cdn.matchapp.fr` |

---
[« Back to Documentation Index](./index.md)
