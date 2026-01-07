import { Hono } from "hono";
import UserController from "../../controllers/user/user.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";

/**
 * Service for defining User routes.
 * Mounts the UserController handlers to the router.
 */
class UserService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller = new UserController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    private initRoutes() {
        // Me routes (Protected)
        this.router.get("/me", authMiddleware, ...this.controller.getMe);
        this.router.put("/me", authMiddleware, ...this.controller.updateMe);
        this.router.delete("/me", authMiddleware, ...this.controller.deleteMe);

        // Notification Preferences (Protected)
        this.router.put("/me/notification-preferences", authMiddleware, ...this.controller.updateNotificationPreferences);

        // Onboarding (Protected)
        this.router.put("/me/onboarding-complete", authMiddleware, ...this.controller.completeOnboarding);

        // Addresses (Protected)
        this.router.get("/me/addresses", authMiddleware, ...this.controller.getAddresses);
        this.router.post("/me/addresses", authMiddleware, ...this.controller.addAddress);
        this.router.put("/me/addresses/:addressId", authMiddleware, ...this.controller.updateAddress);
        this.router.delete("/me/addresses/:addressId", authMiddleware, ...this.controller.deleteAddress);

        // Favorites (Protected)
        this.router.get("/me/favorite-venues", authMiddleware, ...this.controller.getFavorites);

        // Public Profile
        this.router.get("/:userId", ...this.controller.getUserProfile);
    }
}

export default UserService;
