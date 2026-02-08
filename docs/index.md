# Match Project - Documentation Index

**Current Version:** `0.9.0-beta`  
**Last Updated:** February 2026

## 📚 General Documentation

| Document | Description |
| :--- | :--- |
| **[🏗️ Architecture](./architecture.md)** | System design, database schema, and project structure. |
| **[🔌 API Routes](./api_routes.md)** | Complete API endpoint reference. |
| **[🔐 Authentication](./authentication.md)** | Deep dive into JWT flow and Token Rotation. |
| **[📊 Status Report](./status_report.md)** | Current project status and module completion. |
| **[⚙️ Environment Variables](./environment_variables.md)** | Setup guide for `.env` files. |

## 🧩 Module Guides

| Document | Description |
| :--- | :--- |
| **[💳 Stripe Integration](./stripe_integration.md)** | Setup guide for Subscriptions and Boosts. |
| **[📧 Mail Service](./mail_service.md)** | Microservice details and email templates. |

## 🛠️ Internal Roadmap

*These documents are for active development and audit tracking.*

- **[📋 Implementation Plan](./internal/implementation_plan.md)**
- **[🔍 Verification Report](./internal/verification_report.md)**

---

## 🚀 Quick Start

### Prerequisites
- **Bun** v1.2+
- **Docker** (for PostgreSQL + Redis)

### Commands
```bash
# Install dependencies
bun install

# Run database migrations
bun drizzle-kit push

# Start development server
bun run dev
```

---

## 🧩 System Overview

Match is a reservation platform connecting sports fans with venues. 

- **Venue Owners**: Pay via Stripe (Subscriptions + Boosts) to list venues.
- **Users**: Book tables for free. Earn rewards via Fidelity & Referral programs.
