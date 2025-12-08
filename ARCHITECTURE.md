# Match Project API Architecture

## 🏗️ Overview

This project is a high-performance API built with [Hono](https://hono.dev/) for the Match Project. It follows a modular architecture separating concerns into **Services** and **Controllers**.

## 🚀 Technology Stack

- **Framework**: Hono (Ultra-fast web framework)
- **Runtime**: Bun (Fast JavaScript runtime)
- **Language**: TypeScript

## 📂 Project Structure

```
src/
├── controllers/       # Handle HTTP requests, input validation, and responses
├── services/          # Define route definitions and business logic binding
├── server.ts          # Main entry point, application setup, and route mounting
└── ...
```

## 🧩 Architecture Components

### 1. Controllers (`src/controllers/`)
Controllers are responsible for handling the incoming HTTP requests and returning responses. They do not define routes themselves but provide the handler functions.

**Key Responsibilities:**
- Parse request bodies, query parameters, and path parameters.
- Validate input data (e.g., using Zod or Hono validator).
- Call business logic (Repositories/Services).
- Return JSON responses.

Example Pattern:
```typescript
class ExampleController {
    readonly getItems = this.factory.createHandlers(async (ctx) => {
        // Logic here
        return ctx.json({ data: [] });
    });
}
```

### 2. Services (`src/services/`)
Services in this architecture primarily serve as **Route Definitions**. They bind the Controller handlers to specific HTTP paths using Hono's router instance.

**Key Responsibilities:**
- create a new `Hono` router instance.
- Define HTTP methods (`get`, `post`, `put`, `delete`).
- Bind Controller methods to these paths.
- Expose the router via `getRouter` for the main server to mount.

Example Pattern:
```typescript
class ExampleService {
    private readonly router = new Hono();
    private readonly controller = new ExampleController();

    constructor() {
        this.router.get("/", ...this.controller.getItems);
    }

    public get getRouter() {
        return this.router;
    }
}
```

### 3. Server (`src/server.ts`)
The `server.ts` file is the entry point where all Services are instantiated and mounted to the main Hono application.

**Routing Strategy:**
- **Root-Level Routes**: Mounted directly (e.g., `/auth`, `/matches`, `/sports`).
- **Nested Routes**: Mounted with full path prefixes (e.g., `/venues/:venueId/matches/:matchId/seats`).

## 🛣️ API Modules

- **Auth**: Authentication and session management.
- **Onboarding**: User onboarding flow (preferences, initial setup).
- **Discovery**: Map and venue discovery/search.
- **Venues**: Venue details (read-only for users).
- **Matches**: Match schedules and details.
- **Sports**: List of available sports.
- **Reservations**: Booking flow.
- **Seats**: Seat selection and pricing (nested under Venues).
- **Profile**: User profile and favorites.

## 🔄 Request Flow

1. **Request** hits `server.ts`.
2. Hono matches the **Route Path** (e.g., `/auth/login`).
3. Request is routed to the corresponding **Service** (e.g., `AuthService`).
4. Service delegates to the specific **Method** in **Controller** (e.g., `AuthController.login`).
5. Controller processes request and returns **Response**.

## 🛠️ Adding a New Content

1. Create a `NewController` in `src/controllers/`.
2. Create a `NewService` in `src/services/` and bind controller methods.
3. specific the path in `src/server.ts` and mount the service.
