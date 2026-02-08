# Match Project API Architecture

*Last updated: February 2026*

## 🏗️ Overview

This project is a high-performance API built with [Hono](https://hono.dev/) for the Match Project. It follows a clean, modular architecture separating concerns into **Services** (Route Definitions), **Controllers** (Business Logic & Request Handling), and **Repositories** (Data Access).

## 💼 Business Model

**Match is NOT a ticketing platform.** It's a free reservation system for sports fans:

- **Venue owners pay** a subscription fee (via Stripe) to list their venues on the platform.
- **Users don't pay anything** — reservations are completely FREE.
- **Referral Program**: Users earn rewards (Boosts) for inviting venue owners.
- **Loyalty Program**: Users earn points, badges, and levels for activity.

## 🚀 Technology Stack

| Component | Technology |
|-----------|------------|
| **Framework** | [Hono](https://hono.dev/) (Ultra-fast web framework) |
| **Runtime** | [Bun](https://bun.sh/) (Fast JavaScript runtime) |
| **Language** | TypeScript |
| **Database** | PostgreSQL |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) |
| **Validation** | [Zod](https://zod.dev/) & Hono Zod Validator |
| **Payments** | Stripe (Subscriptions & Webhooks) |
| **Authentication** | JWT (Access + Refresh tokens) |
| **Queues** | BullMQ (Redis) for Mail/Notifications |

## 📂 Project Structure

```
match-api/
├── src/
│   ├── config/            # Configuration files
│   │   └── db/            # Drizzle table definitions
│   ├── controllers/       # Business logic (Controller modules)
│   ├── services/          # Route definitions (Service modules)
│   ├── repository/        # Data access layer
│   ├── middleware/        # Auth & role middleware
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Helper utilities
│   ├── queue/             # BullMQ queue definitions
│   ├── workers/           # Background workers
│   └── server.ts          # Main entry point & route mounting
```

## 🧩 Architecture Components

### 1. Services (`src/services/`)
Services in this architecture primarily serve as **Route Definitions**. They are responsible for creating a `Hono` router instance and binding HTTP paths to Controller methods.

### 2. Controllers (`src/controllers/`)
Controllers contain the actual business logic and request handling code. They validate input, orchestrate logic (often calling Repositories), and return JSON responses.

### 3. Repositories (`src/repository/`)
Repositories abstract the database layer. They use Drizzle ORM to interact with the PostgreSQL database.

### 4. Database Schema (`src/config/db/`)
The database schema is defined using Drizzle ORM's schema builder.

| File | Description |
| :--- | :--- |
| `user.table.ts` | Users & Preferences |
| `venues.table.ts` | Venue information & settings |
| `matches.table.ts` | Sports matches & venue-matches |
| `sports.table.ts` | Sports, leagues, teams |
| `reservations.table.ts` | Table reservations |
| `tables.table.ts` | Venue tables/seating |
| `table-holds.table.ts` | Temporary capacity holds |
| `waitlist.table.ts` | Reservation waitlist |
| `seats.table.ts` | Individual seats (Legacy) |
| `reviews.table.ts` | Venue reviews & ratings |
| `notifications.table.ts` | User notifications & Messaging |
| `subscriptions.table.ts` | Venue owner subscriptions |
| `billing.table.ts` | Invoices & transactions |
| `user-addresses.table.ts` | User saved addresses |
| `user-favorites.table.ts` | Favorite venues |
| `venue-photos.table.ts` | Venue images |
| `referral.table.ts` | Referral codes, history, stats |
| `boost.table.ts` | Boost purchases, prices, analytics |
| `fidelity.table.ts` | Levels, points, badges, challenges |
| `admin.table.ts` | Analytics & Audit logs |
| `token.table.ts` | Refresh tokens |

### 5. Middleware (`src/middleware/`)

| File | Description |
| :--- | :--- |
| `auth.middleware.ts` | JWT authentication verification |
| `role.middleware.ts` | Role-based access control (venue_owner, admin) |

## 🛣️ API Modules

The application is structured into the following domains (mounted in `server.ts`):

| Module | Route Prefix | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **Auth** | `/auth` | Authentication (Login, Register, Refresh) | Partial |
| **Users** | `/users` | User profile, addresses, favorites | ✅ |
| **Discovery** | `/discovery` | Venue/Map discovery, search, nearby | ❌ |
| **Venues** | `/venues` | Venue CRUD, photos, amenities | Partial |
| **Matches** | `/matches` | Match listing, details, venues | ❌ |
| **Reservations** | `/reservations` | Reservation flow, QR codes | ✅ |
| **Partners** | `/partners` | Dashboard, analytics, client management | ✅ |
| **Referral** | `/referral` | Referral codes, stats, rewards | ✅ |
| **Boosts** | `/boosts` | Visibility boosts for venues | ✅ |
| **Fidelity** | `/fidelity` | Loyalty points, badges, challenges | ✅ |
| **Subscriptions** | `/subscriptions` | Venue owner subscriptions (Stripe) | ✅ |
| **Webhooks** | `/webhooks` | Stripe webhook handler | ❌ |
| **Sports** | `/sports` | Sports master data | ❌ |

## 🔄 Request Flow

1. **Request**: Incoming HTTP request hits `server.ts`.
2. **Routing**: `server.ts` delegates to the appropriate **Service**.
3. **Dispatch**: The **Service** matches the route and calls the **Controller**.
4. **Validation**: **Controller** validates input using Zod.
5. **Logic**: **Controller** calls **Repository** methods.
6. **DB Access**: **Repository** executes queries via Drizzle ORM.
7. **Response**: Data flows back up, and **Controller** returns JSON.

## 💳 Stripe Integration

The API integrates with Stripe for venue owner subscriptions and boost purchases:

| Component | Purpose |
| :--- | :--- |
| `subscriptions.service.ts` | Checkout sessions (Subscriptions) |
| `boost.service.ts` | Checkout sessions (One-time purchases) |
| `webhooks.service.ts` | Handle Stripe events (Async) |
| `stripe.worker.ts` | Background worker for webhook processing |

## 🚀 Running the API

```bash
# Install dependencies
bun install

# Run database migrations
bun drizzle-kit push

# Start development server
bun run dev
```