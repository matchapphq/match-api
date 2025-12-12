# Match Project API Architecture

## 🏗️ Overview

This project is a high-performance API built with [Hono](https://hono.dev/) for the Match Project. It follows a clean, modular architecture separating concerns into **Services** (Route Definitions), **Controllers** (Business Logic & Request Handling), and **Repositories** (Data Access).

## 🚀 Technology Stack

- **Framework**: [Hono](https://hono.dev/) (Ultra-fast web framework)
- **Runtime**: [Bun](https://bun.sh/) (Fast JavaScript runtime)
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Validation**: [Zod](https://zod.dev/) & [Hono Zod Validator](https://github.com/honojs/middleware/tree/main/packages/zod-validator)

## 📂 Project Structure

```
src/
├── config/            # Configuration (DB schema, etc.)
│   └── db/            # Drizzle table definitions
├── controllers/       # Business logic and request handlers (Class-based)
├── services/          # Route definitions (binds Controllers to Hono Router)
├── repository/        # Data access layer (DB interaction abstraction)
├── server.ts          # Main entry point, application setup, and route mounting
└── ...
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
The database schema is defined using Drizzle ORM's schema builder. Tables are defined in individual files and exported in `schema.ts` (or aggregated).

## 🛣️ API Modules

The application is structured into the following domains (mounted in `server.ts`):

| Module | Route Prefix | Description |
| :--- | :--- | :--- |
| **Auth** | `/auth` | Authentication (Login, Register, Refresh Token) |
| **Users** | `/users` | User profile management |
| **Onboarding** | `/onboarding` | User onboarding flow & preferences |
| **Discovery** | `/discovery` | Venue/Map discovery endpoints |
| **Venues** | `/venues` | Venue details and management |
| **Matches** | `/matches` | Match scheduling and viewing |
| **Sports** | `/sports` | Available sports master data |
| **Reservations** | `/reservations` | Booking system |
| **Partners** | `/partners` | Partner/Restaurateur specific routes |
| **Reviews** | `/reviews` | User reviews and ratings |
| **Notifications** | `/notifications` | User notifications |
| **Webhooks** | `/webhooks` | External service integration |
| **Coupons** | `/coupons` | Discount and coupon management |
| **Subscriptions** | `/subscriptions` | Venue owner subscriptions |
| **Billing** | `/` | Invoices and transactions (mounted at root/globally) |
| **Analytics** | `/venues/:id/analytics`| Venue performance analytics |
| **Messaging** | `/` | Chat and conversations (mounted at root) |

## 🔄 Request Flow

1. **Request**: Incoming HTTP request hits `server.ts`.
2. **Routing**: `server.ts` delegates to the appropriate **Service** based on the path (e.g., `/auth`).
3. **Dispatch**: The **Service** matches the specific route (e.g., `/login`) and calls the **Controller** handler.
4. **Validation**: **Controller** validates input using Zod.
5. **Logic**: **Controller** calls **Repository** methods to fetch/persist data.
6. **DB Access**: **Repository** executes queries via Drizzle ORM.
7. **Response**: Data flows back up, and **Controller** returns a JSON response.

## 🛠️ Adding a New Feature

1.  **Database**: Define new tables in `src/config/db/`.
2.  **Repository**: Create `src/repository/feature.repository.ts` for DB access.
3.  **Controller**: Create `src/controllers/feature/feature.controller.ts` for logic.
4.  **Service**: Create `src/services/feature/feature.service.ts` to define routes.
5.  **Mount**: Import and mount the new Service in `src/server.ts`.
