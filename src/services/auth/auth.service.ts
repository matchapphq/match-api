import { Hono } from "hono";
import AuthController from "../../controllers/auth/auth.controller";

/**
 * Service for defining Authentication routes.
 * Mounts the AuthController handlers to the router.
 */
class AuthService {
    private readonly router = new Hono();
    private readonly authController = new AuthController();

    public get getRouter() {
        return this.router;
    }

    constructor() {
        this.initRoutes();
    }

    initRoutes() {
        this.router.post("/register", ...this.authController.register);
        this.router.post("/login", ...this.authController.login);
        this.router.post("/refresh-token", ...this.authController.refreshToken);
        this.router.get("/me", ...this.authController.getMe);
        this.router.put("/me", ...this.authController.updateMe);
        this.router.delete("/me", ...this.authController.deleteMe);
        this.router.post("/logout", ...this.authController.logout);
    }
}

export default AuthService;