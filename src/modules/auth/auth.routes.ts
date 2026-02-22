import { Hono } from "hono";
import AuthController from "./auth.controller";
import { AuthLogic } from "./auth.logic";
import UserRepository from "../../repository/user.repository";
import TokenRepository from "../../repository/token.repository";
import AuthRepository from "../../repository/auth/auth.repository";
import referralRepository from "../../repository/referral.repository";
import { StorageService } from "../../services/storage.service";
import { Redis } from "ioredis";

/**
 * Service for defining Authentication routes (Router/Module layer).
 */
class AuthService {
    private readonly router = new Hono();
    private readonly controller: AuthController;

    public get getRouter() {
        return this.router;
    }

    constructor() {
        // 1. Dependency Injection
        const userRepository = new UserRepository();
        const tokenRepository = new TokenRepository();
        const authRepository = new AuthRepository();
        const storageService = new StorageService();
        const redis = new Redis({ 
            host: process.env.REDIS_HOST || 'localhost', 
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
        });

        const authLogic = new AuthLogic(
            userRepository,
            tokenRepository,
            authRepository,
            referralRepository,
            redis,
            storageService
        );

        this.controller = new AuthController(authLogic);

        // 2. Init Routes
        this.initRoutes();
    }

    private initRoutes() {
        this.router.post("/register", ...this.controller.register);
        this.router.post("/login", ...this.controller.login);
        this.router.post("/google", ...this.controller.googleLogin);
        this.router.post("/refresh-token", ...this.controller.refreshToken);
        this.router.post("/logout", ...this.controller.logout);
        this.router.post("/forgot-password", ...this.controller.forgotPassword);
        this.router.post("/verify-reset-code", ...this.controller.verifyResetCode);
        this.router.post("/reset-password", ...this.controller.resetPassword);
        this.router.post("/validate-email", ...this.controller.validateEmail);
    }
}

export default AuthService;
