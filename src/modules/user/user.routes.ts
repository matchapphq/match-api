import { Hono } from "hono";
import UserController from "./user.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";
import { UserLogic } from "./user.logic";
import UserRepository from "../../repository/user.repository";
import { FavoritesRepository } from "../../repository/favorites.repository";
import TokenRepository from "../../repository/token.repository";
import { StorageService } from "../../services/storage.service";

/**
 * Service for defining User routes (Router/Module layer).
 * Handles Dependency Injection and mounts the UserController handlers.
 */
class UserService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller: UserController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        // 1. Manual Dependency Injection (NestJS Module style)
        const userRepository = new UserRepository();
        const favoritesRepository = new FavoritesRepository();
        const tokenRepository = new TokenRepository();
        const storageService = new StorageService();
        const userLogic = new UserLogic(userRepository, favoritesRepository, tokenRepository, storageService);
        
        this.controller = new UserController(userLogic);

        // 2. Initialize Routes
        this.initRoutes();
    }

    private initRoutes() {
        // Me routes (Protected)
        this.router.get("/me", authMiddleware, ...this.controller.getMe);
        this.router.put("/me", authMiddleware, ...this.controller.updateMe);
        this.router.put("/me/password", authMiddleware, ...this.controller.updatePassword);
        this.router.post("/me/session-heartbeat", authMiddleware, ...this.controller.touchSessionHeartbeat);
        this.router.get("/me/sessions", authMiddleware, ...this.controller.getSessions);
        this.router.delete("/me/sessions/others", authMiddleware, ...this.controller.revokeOtherSessions);
        this.router.delete("/me/sessions/:sessionId", authMiddleware, ...this.controller.revokeSession);
        this.router.delete("/me", authMiddleware, ...this.controller.deleteMe);

        // Notification Preferences (Protected)
        this.router.get("/me/notification-preferences", authMiddleware, ...this.controller.getNotificationPreferences);
        this.router.put("/me/notification-preferences", authMiddleware, ...this.controller.updateNotificationPreferences);
        this.router.get("/me/privacy-preferences", authMiddleware, ...this.controller.getPrivacyPreferences);
        this.router.put("/me/privacy-preferences", authMiddleware, ...this.controller.updatePrivacyPreferences);
        this.router.put("/me/push-token", authMiddleware, ...this.controller.updatePushToken);

        // Favorites (Protected)
        this.router.get("/me/favorites", authMiddleware, ...this.controller.getFavorites);

        // Public Profile
        this.router.get("/:userId", ...this.controller.getUserProfile);
    }
}

export default UserService;
