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

    private initRoutes() {
        this.router.post("/register", ...this.authController.register);
        this.router.post("/login", ...this.authController.login);
        this.router.post("/refresh-token", ...this.authController.refreshToken);
        this.router.post("/logout", ...this.authController.logout);
        this.router.post("/forgot-password", ...this.authController.forgotPassword);
        this.router.post("/verify-reset-code", ...this.authController.verifyResetCode);
        this.router.post("/reset-password", ...this.authController.resetPassword);
    }
}

export default AuthService;