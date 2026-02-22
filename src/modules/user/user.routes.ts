import { Hono } from "hono";
import UserController from "./user.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";
import { UserLogic } from "./user.logic";
import UserRepository from "../../repository/user.repository";
import { FavoritesRepository } from "../../repository/favorites.repository";
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
        const storageService = new StorageService();
        const userLogic = new UserLogic(userRepository, favoritesRepository, storageService);
        
        this.controller = new UserController(userLogic);

        // 2. Initialize Routes
        this.initRoutes();
    }

    private initRoutes() {
        // Me routes (Protected)
        this.router.get("/me", authMiddleware, ...this.controller.getMe);
        this.router.put("/me", authMiddleware, ...this.controller.updateMe);
        this.router.put("/me/password", authMiddleware, ...this.controller.updatePassword);
        this.router.delete("/me", authMiddleware, ...this.controller.deleteMe);

        // Notification Preferences (Protected)
        this.router.put("/me/notification-preferences", authMiddleware, ...this.controller.updateNotificationPreferences);
        this.router.put("/me/push-token", authMiddleware, ...this.controller.updatePushToken);

        // Favorites (Protected)
        this.router.get("/me/favorites", authMiddleware, ...this.controller.getFavorites);

        // Public Profile
        this.router.get("/:userId", ...this.controller.getUserProfile);
    }
}

export default UserService;