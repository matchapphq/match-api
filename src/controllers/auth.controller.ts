import { password } from "bun";
import { validator } from "hono/validator";
import { createFactory } from "hono/factory";
import type { userRegisterData } from "../utils/userData";
import UserRepository from "../repository/user.repository";
import { RegisterRequestSchema, LoginRequestSchema } from "../utils/auth.valid";

/**
 * Controller for Authentication operations.
 * Handles user registration, login, token refreshing, and profile management.
 */
class AuthController {
    private readonly factory = createFactory();
    private readonly userRepository = new UserRepository();

    readonly register = this.factory.createHandlers(validator("json", (value, ctx) => {
        const parsed = RegisterRequestSchema.safeParse(value);
        if (!parsed.success) {
            return ctx.json({ error: "Invalid request body", details: parsed.error }, 401);
        }
        return parsed.data;
    }), async (ctx) => {
        const body = ctx.req.valid("json");
        if (!body) {
            return ctx.json({ msg: "Invalid Request body" }, 401);
        }
        const userRequest: userRegisterData = {
            ...body,
        };
        console.log(userRequest);
        const user = await this.userRepository.createUser(userRequest);
        if (!user) {
            return ctx.json({ msg: "User not created" }, 401)
        }
        return ctx.json({ msg: "User created", data: user });
    })

    readonly login = this.factory.createHandlers(validator('json', (value, ctx) => {
        const parsed = LoginRequestSchema.safeParse(value);
        if (!parsed.success) {
            return ctx.json({ error: "Invalid request body", details: parsed.error })
        }
        return parsed.data;
    }), async (ctx) => {
        const body = ctx.req.valid("json");
        if (!body) {
            return ctx.json({ msg: "Invalid Request body" }, 401)
        }
        const user = await this.userRepository.getUserByEmail(body.email);
        if (!user) {
            return ctx.json({ msg: "User not found" }, 401)
        }
        const passwordMatch = await password.verify(body.password, user.password_hash);
        if (!passwordMatch) {
            return ctx.json({ msg: "Invalid password" }, 401)
        }
        return ctx.json({ msg: "User logged in" });
    });

    readonly logout = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "User logged out" });
    });

    readonly refreshToken = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Token refreshed" });
    });

    readonly getMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Current user profile" });
    });

    readonly updateMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Profile updated" });
    });

    readonly deleteMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Account deleted" });
    });
}

export default AuthController;
