import { password } from "bun";
import { validator } from "hono/validator";
import { createFactory } from "hono/factory";
import type { userRegisterData } from "../../utils/userData";
import UserRepository from "../../repository/user.repository";
import { RegisterRequestSchema, LoginRequestSchema } from "../../utils/auth.valid";
import { JwtUtils } from "../../utils/jwt";
import { z } from "zod";
import TokenRepository from "../../repository/token.repository";
import { setCookie } from "hono/cookie";

/**
 * Controller for Authentication operations.
 * Handles user registration, login, token refreshing, and profile management.
 */
class AuthController {
    private readonly factory = createFactory();
    private readonly userRepository = new UserRepository();
    private readonly tokenRepository = new TokenRepository();

    readonly register = this.factory.createHandlers(validator("json", (value, ctx) => {
        const parsed = RegisterRequestSchema.safeParse(value);
        if (!parsed.success) {
            return ctx.json({ error: "Invalid request body", details: parsed.error }, 401);
        }
        return parsed.data;
    }), async (ctx) => {
        const body = ctx.req.valid("json");

        // Check if user already exists
        const existingUser = await this.userRepository.getUserByEmail(body.email);
        if (existingUser) {
            return ctx.json({ error: "User with this email already exists" }, 409);
        }

        const userRequest: userRegisterData = {
            ...body,
            role: body.role as 'user' | 'venue_owner' | 'admin' || 'user'
        };

        try {
            const user = await this.userRepository.createUser(userRequest);

            // Generate Tokens
            const tokenPayload = { id: user.id, email: user.email, role: user.role };

            const deviceId = ctx.req.header("User-Agent") || "Unknown";

            const [accessToken, refreshToken] = await Promise.all([
                JwtUtils.generateAccessToken(tokenPayload),
                JwtUtils.generateRefreshToken(tokenPayload)
            ]);

            await this.tokenRepository.createToken(refreshToken, user.id, deviceId);
            
            setCookie(ctx, "refresh_token", refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: "lax",
                path: "/auth/refresh",
                maxAge: JwtUtils.REFRESH_TOKEN_EXP
            });

            return ctx.json({
                user,
                token: accessToken,
                refresh_token: refreshToken
            }, 201);
        } catch (error) {
            console.error("Registration error:", error);
            return ctx.json({ error: "Registration failed" }, 500);
        }
    })

    readonly login = this.factory.createHandlers(validator('json', (value, ctx) => {
        const parsed = LoginRequestSchema.safeParse(value);
        if (!parsed.success) {
            return ctx.json({ error: "Invalid request body", details: parsed.error }, 400)
        }
        return parsed.data;
    }), async (ctx) => {
        const body = ctx.req.valid("json");
        const user = await this.userRepository.getUserByEmail(body.email);

        if (!user) {
            return ctx.json({ error: "Invalid email or password" }, 401)
        }

        const passwordMatch = await password.verify(body.password, user.password_hash);
        if (!passwordMatch) {
            return ctx.json({ error: "Invalid email or password" }, 401)
        }

        const tokenPayload = { id: user.id, email: user.email, role: user.role };
        const [accessToken, refreshToken] = await Promise.all([
            JwtUtils.generateAccessToken(tokenPayload),
            JwtUtils.generateRefreshToken(tokenPayload)
        ])

        return ctx.json({
            user: { id: user.id, email: user.email, role: user.role }, // returning partial user for safety
            token: accessToken,
            refresh_token: refreshToken
        });
    });

    readonly refreshToken = this.factory.createHandlers(async (ctx) => {
        const body = await ctx.req.json();
        const { refresh_token } = body;

        if (!refresh_token) {
            return ctx.json({ error: "Refresh token is required" }, 400);
        }

        const payload = await JwtUtils.verifyRefreshToken(refresh_token);
        if (!payload) {
            return ctx.json({ error: "Invalid or expired refresh token" }, 401);
        }

        // Generate new access token
        const newAccessToken = await JwtUtils.generateAccessToken({ id: payload.id, email: payload.email, role: payload.role });
        return ctx.json({ token: newAccessToken });
    });

    readonly logout = this.factory.createHandlers(async (ctx) => {
        // In JWT stateless auth, logout is client-side. 
        // Optional: Blacklist token in Redis if implemented.
        return ctx.json({ message: "Logged out successfully" });
    });

    // Stubs for other methods
    readonly getMe = this.factory.createHandlers(async (ctx) => {
        // Middleware should have attached user to context
        // const user = ctx.get('user');
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
