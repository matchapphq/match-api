import { Hono } from "hono";
import UserController from "../../controllers/user/user.controller";

/**
 * Service for defining User routes.
 * Mounts the UserController handlers to the router.
 */
class UserService {
    private readonly router = new Hono();
    private readonly controller = new UserController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        // Me routes
        this.router.get("/me", ...this.controller.getMe);
        this.router.put("/me", ...this.controller.updateMe);
        this.router.delete("/me", ...this.controller.deleteMe);

        // Notification Preferences
        this.router.put("/me/notification-preferences", ...this.controller.updateNotificationPreferences);

        // Onboarding
        this.router.put("/me/onboarding-complete", ...this.controller.completeOnboarding);

        // Addresses
        this.router.get("/me/addresses", ...this.controller.getAddresses);
        this.router.post("/me/addresses", ...this.controller.addAddress);
        this.router.put("/me/addresses/:addressId", ...this.controller.updateAddress);
        this.router.delete("/me/addresses/:addressId", ...this.controller.deleteAddress);

        // Favorites
        this.router.get("/me/favorite-venues", ...this.controller.getFavorites);

        // Public Profile
        this.router.get("/:userId", ...this.controller.getUserProfile);
    }
}

export default UserService;
