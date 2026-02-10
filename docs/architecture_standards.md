[🏠 Home](./index.md) | [🏗️ Architecture](./architecture.md) | [🔌 API Routes](./api_routes.md) | [📊 Status](./status_report.md)

---

# Architecture & Coding Standards (Hono-Nest Style)

*Last updated: February 2026*

## 🏛️ The "Match Enterprise" Pattern

To ensure the Match API remains scalable, testable, and maintainable, we follow a **Layered Architecture** inspired by NestJS but optimized for Hono's performance. Every module must be split into three distinct layers.

### 1. The Logic Layer (`*.logic.ts`)
**Responsibility**: Pure business logic and data orchestration.
- **Rules**:
    - MUST NOT import `hono` or use `Context`.
    - MUST receive dependencies (Repositories, other Logic services) via the **Constructor**.
    - Returns raw data or throws semantic Errors (e.g., `USER_NOT_FOUND`).
- **Standard**:
```typescript
export class UserLogic {
    constructor(private readonly userRepo: UserRepository) {}

    async getProfile(id: string) {
        const user = await this.userRepo.findById(id);
        if (!user) throw new Error("USER_NOT_FOUND");
        return user;
    }
}
```

### 2. The Controller Layer (`*.controller.ts`)
**Responsibility**: HTTP Adapter (Input validation, Response mapping, Cookies).
- **Rules**:
    - Uses `createFactory<HonoEnv>()` for middleware and type safety.
    - Maps Logic Layer errors to HTTP status codes (404, 401, etc.).
    - Handles `Context` operations (session, headers, params).
- **Standard**:
```typescript
export class UserController {
    private readonly factory = createFactory<HonoEnv>();
    constructor(private readonly userLogic: UserLogic) {}

    public readonly getMe = this.factory.createHandlers(async (c) => {
        try {
            const user = await this.userLogic.getProfile(c.get('user').id);
            return c.json({ user });
        } catch (e: any) {
            if (e.message === "USER_NOT_FOUND") return c.json({ error: "Not found" }, 404);
            return c.json({ error: "Internal Error" }, 500);
        }
    });
}
```

### 3. The Router Layer (`*.service.ts`)
**Responsibility**: Module wiring and route definitions.
- **Rules**:
    - Acts as the "Dependency Injection" container.
    - Instantiates the Logic and Controller layers.
    - Mounts middleware and handlers to the Hono router.
- **Standard**:
```typescript
class UserService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller: UserController;

    constructor() {
        const logic = new UserLogic(new UserRepository());
        this.controller = new UserController(logic);
        this.initRoutes();
    }

    private initRoutes() {
        this.router.get("/me", authMiddleware, ...this.controller.getMe);
    }
    
    public get getRouter() { return this.router; }
}
```

---

## 🚀 Why We Use This Architecture

| Feature | Benefit |
| :--- | :--- |
| **Separation of Concerns** | Logic is independent of HTTP. You can call `UserLogic` from a background worker without mocking a Request. |
| **Testability** | You can unit test Logic services by passing "Mock" repositories into the constructor. |
| **Scalability** | As the project grows, "Fat Controllers" are avoided. The logic stays clean and focused. |
| **Standardization** | Every developer knows exactly where to find business rules (Logic) vs HTTP logic (Controller). |

## 🛠️ Implementation Checklist for New Modules

1. [ ] Create directory: `src/services/my-module/`
2. [ ] Define `MyModuleLogic` class in `my-module.logic.ts`.
3. [ ] Define `MyModuleController` class in `../../controllers/my-module/my-module.controller.ts`.
4. [ ] Wire them together in `MyModuleService` in `my-module.service.ts`.
5. [ ] Mount the service in `src/server.ts`.

---
[« Back to Documentation Index](./index.md)
