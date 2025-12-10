import { Hono } from "hono";
import ProfileController from "../../controllers/profile/profile.controller";

/**
 * Service for defining Profile routes.
 * Mounts the ProfileController handlers to the router.
 */
class ProfileService {
    private readonly router = new Hono();
    private readonly controller = new ProfileController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.get("/", ...this.controller.getProfile);
        this.router.get("/favorites", ...this.controller.getFavorites);
        this.router.post("/favorites/:venueId", ...this.controller.addFavorite);
        this.router.delete("/favorites/:venueId", ...this.controller.removeFavorite);
        this.router.get("/preferences", ...this.controller.getPreferences);
    }
}

export default ProfileService;
