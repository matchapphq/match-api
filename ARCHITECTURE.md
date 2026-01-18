# Match Project API Architecture

*Last updated: January 2026*

## 🏗️ Overview

This project is a high-performance API built with [Hono](https://hono.dev/) for the Match Project. It follows a clean, modular architecture separating concerns into **Services** (Route Definitions), **Controllers** (Business Logic & Request Handling), and **Repositories** (Data Access).

## 💼 Business Model

**Match is NOT a ticketing platform.** It's a free reservation system for sports fans:

- **Venue owners pay** a subscription fee (via Stripe) to list their venues on the platform
- **Users don't pay anything** — reservations are completely FREE (like booking a restaurant table)
- Users simply select a match, choose a venue broadcasting it, specify party size, and get a QR code
- Venue owners scan the QR code to verify reservations on match day

Think of it as "OpenTable for watching sports" — not "Ticketmaster for bars".

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

## 📂 Project Structure

```
match-api/
├── src/
│   ├── config/            # Configuration files
│   │   └── db/            # Drizzle table definitions (22 schema files)
│   ├── controllers/       # Business logic (18 controller modules)
│   ├── services/          # Route definitions (21 service modules)
│   ├── repository/        # Data access layer (14 repository files)
│   ├── middleware/        # Auth & role middleware
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Helper utilities
│   └── server.ts          # Main entry point & route mounting
├── drizzle.config.ts      # Drizzle ORM configuration
├── index.ts               # Application bootstrap
└── package.json           # Dependencies
```

## 🧩 Architecture Components

### 1. Services (`src/services/`)
Services in this architecture primarily serve as **Route Definitions**. They are responsible for creating a `Hono` router instance and binding HTTP paths to Controller methods.

**Key Responsibilities:**
- Define routes (GET, POST, PUT, DELETE).
- Bind Controller handlers to routes.
- Expose the router via `getRouter`.

**Example:**
```typescript
class AuthService {
    private readonly router = new Hono();
    private readonly controller = new AuthController();

    constructor() {
        // Definitions
        this.router.post("/login", ...this.controller.login);
    }
}
```

### 2. Controllers (`src/controllers/`)
Controllers contain the actual business logic and request handling code. They validate input, orchestrate logic (often calling Repositories), and return JSON responses.

**Key Responsibilities:**
- Request validation (using Zod schemas).
- Logic orchestration.
- Calling Repository methods.
- Sending Responses.

**Example:**
```typescript
class AuthController {
    readonly login = this.factory.createHandlers(validator('json', ...), async (ctx) => {
        // Logic
        return ctx.json({ token: "..." });
    });
}
```

### 3. Repositories (`src/repository/`)
Repositories abstract the database layer. They use Drizzle ORM to interact with the PostgreSQL database. This keeps SQL/ORM logic out of controllers.

**Structure:**
- Flat files in `src/repository/` (e.g., `user.repository.ts`, `venue.repository.ts`).

**Key Responsibilities:**
- Querying the database (select, insert, update, delete).
- Returning typed data objects.

### 4. Database Schema (`src/config/db/`)
The database schema is defined using Drizzle ORM's schema builder. Tables are defined in individual files:

| File | Description |
| :--- | :--- |
| `user.table.ts` | Users (regular users & venue owners) |
| `venues.table.ts` | Venue information & settings |
| `matches.table.ts` | Sports matches & events |
| `sports.table.ts` | Sports, leagues, teams |
| `reservations.table.ts` | Table reservations |
| `tables.table.ts` | Venue tables/seating |
| `table-holds.table.ts` | Temporary table holds |
| `waitlist.table.ts` | Reservation waitlist |
| `seats.table.ts` | Individual seats |
| `reviews.table.ts` | Venue reviews & ratings |
| `notifications.table.ts` | User notifications |
| `subscriptions.table.ts` | Venue owner subscriptions |
| `billing.table.ts` | Invoices & transactions |
| `user-addresses.table.ts` | User saved addresses |
| `user-favorites.table.ts` | Favorite venues |
| `venue-photos.table.ts` | Venue images |
| `token.table.ts` | Refresh tokens |
| `enums.ts` | PostgreSQL enum types |
| `relations.ts` | Drizzle ORM relations |
| `schema.ts` | Aggregated schema export |

### 5. Middleware (`src/middleware/`)

| File | Description |
| :--- | :--- |
| `auth.middleware.ts` | JWT authentication verification |
| `role.middleware.ts` | Role-based access control (venue_owner, admin) |

## 🛣️ API Modules

The application is structured into the following domains (mounted in `server.ts`):

| Module | Route Prefix | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **Auth** | `/auth` | Authentication (Login, Register, Refresh Token, Me) | Partial |
| **Users** | `/users` | User profile, addresses, favorites | ✅ |
| **Onboarding** | `/onboarding` | User onboarding completion | ❌ |
| **Discovery** | `/discovery` | Venue/Map discovery, search, nearby | ❌ |
| **Venues** | `/venues` | Venue CRUD, photos, reviews, matches | Partial |
| **Matches** | `/matches` | Match listing, details, venues | ❌ |
| **Sports** | `/sports` | Sports master data | ❌ |
| **Leagues** | `/leagues` | League details and teams | ❌ |
| **Teams** | `/teams` | Team details | ❌ |
| **Reservations** | `/reservations` | FREE table booking, QR codes, waitlist | ✅ |
| **Seats** | `/venues/:id/seats` | Seat maps and pricing | Partial |
| **Partners** | `/partners` | Venue owner dashboard & management | ✅ |
| **Reviews** | `/reviews` | Review updates and helpful votes | ✅ |
| **Notifications** | `/notifications` | User notifications | ✅ |
| **Messaging** | `/conversations`, `/messages` | Chat system | ✅ |
| **Subscriptions** | `/subscriptions` | Venue owner subscriptions (Stripe) | Partial |
| **Billing** | `/invoices`, `/transactions` | Invoices and transactions | ✅ |
| **Analytics** | `/venues/:id/analytics` | Venue performance analytics | ✅ |
| **Coupons** | `/coupons` | Coupon validation | ❌ |
| **Webhooks** | `/webhooks` | Stripe webhook handler | ❌ |

## 🔄 Request Flow

1. **Request**: Incoming HTTP request hits `server.ts`.
2. **Routing**: `server.ts` delegates to the appropriate **Service** based on the path (e.g., `/auth`).
3. **Dispatch**: The **Service** matches the specific route (e.g., `/login`) and calls the **Controller** handler.
4. **Validation**: **Controller** validates input using Zod.
5. **Logic**: **Controller** calls **Repository** methods to fetch/persist data.
6. **DB Access**: **Repository** executes queries via Drizzle ORM.
7. **Response**: Data flows back up, and **Controller** returns a JSON response.

## 🛠️ Adding a New Feature

1. **Database**: Define new tables in `src/config/db/`.
2. **Repository**: Create `src/repository/feature.repository.ts` for DB access.
3. **Controller**: Create `src/controllers/feature/feature.controller.ts` for logic.
4. **Service**: Create `src/services/feature/feature.service.ts` to define routes.
5. **Mount**: Import and mount the new Service in `src/server.ts`.

## 🔐 Authentication Flow

```
1. User registers/logs in → receives access_token + refresh_token
2. Access token (short-lived) used for API requests via Bearer header
3. When access token expires, use refresh_token to get new access_token
4. Refresh tokens stored in database (token.table.ts)
```

**Protected routes** are secured via `authMiddleware` which:
- Extracts JWT from `Authorization: Bearer <token>` header
- Verifies token signature and expiration
- Attaches user data to request context

**Role-based routes** use `venueOwnerMiddleware` for venue owner-only endpoints.

## 💳 Stripe Integration

The API integrates with Stripe for venue owner subscriptions:

| Component | Purpose |
| :--- | :--- |
| `subscriptions.service.ts` | Checkout sessions, plan management |
| `webhooks.service.ts` | Handle Stripe events |
| `billing.service.ts` | Invoices & transactions |

**Webhook Events Handled:**
- `payment_method.attached`
- `invoice.paid` / `invoice.payment_failed`
- `customer.subscription.updated` / `deleted`

## 🚀 Running the API

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env

# Run database migrations
bun drizzle-kit push

# Start development server
bun run dev

# Production
bun run start
```

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for signing JWTs
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

## 📚 Related Documentation

- [`API_ROUTES.md`](./API_ROUTES.md) - Complete API endpoint documentation
- [`STRIPE_INTEGRATION.md`](./STRIPE_INTEGRATION.md) - Detailed Stripe setup guide
