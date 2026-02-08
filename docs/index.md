# Match Project - Documentation Index

**Current Version:** `0.9.0-beta`  
**Last Updated:** February 2026

## 📚 Documentation Map

| Document | Description |
| :--- | :--- |
| **[🏗️ Architecture](./architecture.md)** | System design, database schema, and project structure. |
| **[🔌 API Routes](./api_routes.md)** | Complete API endpoint reference with request/response examples. |
| **[📊 Status Report](./status_report.md)** | Current project status, module completion, and roadmap. |
| **[💳 Stripe Integration](./stripe_integration.md)** | Setup guide for Subscriptions and Boosts. |
| **[📧 Mail Service](./mail_service.md)** | Microservice details, queues, and email templates. |
| **[📋 Implementation Plan](./implementation_plan.md)** | Active refactoring and feature implementation roadmap. |
| **[🔍 Verification Report](./verification_report.md)** | Audit findings and required fixes. |

---

## 🚀 Quick Start

### Prerequisites
- **Bun** v1.2+
- **Docker** (for PostgreSQL + Redis)

### Commands
```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Run database migrations
bun drizzle-kit push

# Seed database
bun run db:seed
```

### Docker
```bash
docker-compose up
```

---

## 🧩 System Overview

Match is a reservation system for sports fans. It connects users with venues broadcasting matches.

- **Venue Owners**: Pay via Stripe (Subscriptions + Boosts) to list venues.
- **Users**: Book tables for free. Use QR codes for check-in. Earn rewards via Fidelity & Referral programs.

### Key Modules
- **Auth**: JWT-based, includes onboarding & referrals.
- **Fidelity**: Points, Badges, Challenges system.
- **Reservations**: Capacity-based booking with Instant/Request modes.
- **Discovery**: Geo-spatial search for venues and matches.