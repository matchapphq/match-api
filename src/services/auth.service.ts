import { Hono } from "hono";
import AuthController from "../controllers/auth.controller";

class AuthService {
    private readonly router =  new Hono();
    private readonly authController = new AuthController();

    public get getRouter() {
        return this.router;
    }

    constructor () {
        this.initRoutes();
    }

    initRoutes() {
        this.router.post("/register", ...this.authController.register);
        this.router.post("/login" );
        this.router.post("/logout" );
        this.router.post("/reset" );
    }
}

export default AuthService;