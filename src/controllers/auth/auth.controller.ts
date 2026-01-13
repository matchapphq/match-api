import { password } from "bun";
import { JwtUtils } from "../../utils/jwt";
import { validator } from "hono/validator";
import { createFactory } from "hono/factory";
import type { userRegisterData } from "../../utils/userData";
import UserRepository from "../../repository/user.repository";
import TokenRepository from "../../repository/token.repository";
import { setCookie, getCookie, setSignedCookie, deleteCookie, getSignedCookie } from "hono/cookie";
import { RegisterRequestSchema, LoginRequestSchema } from "../../utils/auth.valid";
import referralRepository from "../../repository/referral.repository";

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
            if (!user || !user.first_name) {
                return ctx.json({ error: "Failed to create user" }, 500);
            }

            // Optional referral code handling (non-blocking)
            if (body.referralCode) {
                try {
                    const referralResult = await referralRepository.registerReferral(body.referralCode, user.id);
                    if (!referralResult.success) {
                        console.warn("Referral registration failed:", referralResult.error);
                    }
                } catch (referralError) {
                    console.error("Referral registration exception:", referralError);
                    // Do not block user creation if referral flow fails
                }
            }

            // Generate Tokens
            const tokenPayload = { id: user.id, email: user.email, role: user.role, firstName: user.first_name };

            const deviceId = ctx.req.header("User-Agent") || "Unknown";

            const [accessToken, refreshToken] = await Promise.all([
                JwtUtils.generateAccessToken(tokenPayload),
                JwtUtils.generateRefreshToken(tokenPayload)
            ]);

            await this.tokenRepository.createToken(refreshToken, user.id, deviceId);

            await Promise.all([
                setSignedCookie(ctx, "refresh_token", refreshToken, JwtUtils.REFRESH_JWT_SIGN_KEY, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: "Strict",
                    path: "/auth/refresh",
                    maxAge: JwtUtils.REFRESH_TOKEN_EXP
                }),
                setSignedCookie(ctx, "access_token", accessToken, JwtUtils.ACCESS_JWT_SIGN_KEY, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: "Strict",
                    path: "/",
                    maxAge: JwtUtils.ACCESS_TOKEN_EXP
                })
            ])

            return ctx.json({ user, token: accessToken }, 201);
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

        if (!user || !user.first_name) {
            return ctx.json({ error: "Invalid email or password" }, 401)
        }

        const passwordMatch = await password.verify(body.password, user.password_hash);
        if (!passwordMatch) {
            return ctx.json({ error: "Invalid email or password" }, 401)
        }

        const tokenPayload = { id: user.id, email: user.email, role: user.role, firstName: user.first_name };
        const [accessToken, refreshToken] = await Promise.all([
            JwtUtils.generateAccessToken(tokenPayload),
            JwtUtils.generateRefreshToken(tokenPayload)
        ])

        const deviceId = ctx.req.header("User-Agent") || "Unknown";

        await this.tokenRepository.createToken(refreshToken, user.id, deviceId);

        await Promise.all([
            setSignedCookie(ctx, "access_token", accessToken, JwtUtils.ACCESS_JWT_SIGN_KEY, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: "Strict",
                path: "/",
                maxAge: JwtUtils.ACCESS_TOKEN_EXP
            }),
            setSignedCookie(ctx, "refresh_token", refreshToken, JwtUtils.REFRESH_JWT_SIGN_KEY, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: "Strict",
                path: "/auth/refresh",
                maxAge: JwtUtils.REFRESH_TOKEN_EXP
            })
        ]);

        return ctx.json({
            user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name },
            token: accessToken
        });
    });

    readonly refreshToken = this.factory.createHandlers(async (ctx) => {
        const oldRefreshToken = await getSignedCookie(ctx, JwtUtils.REFRESH_JWT_SIGN_KEY, 'refresh_token');

        if (!oldRefreshToken) {
            return ctx.json({ error: "Refresh token is required" }, 401);
        }

        const payload = await JwtUtils.verifyRefreshToken(oldRefreshToken);
        if (!payload) {
            return ctx.json({ error: "Invalid or expired refresh token" }, 401);
        }

        // Consistency check: Verify token exists in DB and matches
        // We retrieve all tokens for the user and check if any match the provided refresh token.
        const dbTokens = await this.tokenRepository.getAllTokensByUserId(payload.id);

        if (!dbTokens || dbTokens.length === 0) {
            // Token claimed to be valid (signature-wise) but no record in DB -> Revoked or invalid state
            return ctx.json({ error: "Invalid session" }, 401);
        }

        let matchedToken = null;
        for (const t of dbTokens) {
            const isValid = await password.verify(oldRefreshToken, t.hash_token);
            if (isValid) {
                matchedToken = t;
                break;
            }
        }

        if (!matchedToken) {
            // Security Alert: Token signature valid but hash mismatch against all stored tokens.
            // Likely token reuse or theft. Revoking all tokens for safety is a good practice here.
            await this.tokenRepository.deleteTokensByUserId(payload.id);
            return ctx.json({ error: "Invalid info" }, 401);
        }

        // Generate new tokens (Rotate)
        const newPayload = { id: payload.id, email: payload.email, role: payload.role, firstName: payload.firstName };
        const [newAccessToken, newRefreshToken] = await Promise.all([
            JwtUtils.generateAccessToken(newPayload),
            JwtUtils.generateRefreshToken(newPayload)
        ]);

        // Update the existing token record (the matched one)
        const deviceId = ctx.req.header("User-Agent") || matchedToken.device || "Unknown";
        await this.tokenRepository.updateToken(newRefreshToken, payload.id, deviceId, matchedToken.id);

        setCookie(ctx, "refresh_token", newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/auth/refresh",
            maxAge: JwtUtils.REFRESH_TOKEN_EXP
        });

        ctx.header("Authorization", `Bearer ${newAccessToken}`);

        return ctx.json({
            token: newAccessToken,
            refresh_token: newRefreshToken
        });
    });

    readonly logout = this.factory.createHandlers(async (ctx) => {
        // In JWT stateless auth, logout is client-side. 
        // Optional: Blacklist token in Redis if implemented.
        deleteCookie(ctx, "refresh_token");
        deleteCookie(ctx, "access_token");
        return ctx.json({ message: "Logged out successfully" });
    });

    // Stub - use /users/me instead
    readonly getMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Use /users/me endpoint instead" }, 301);
    });

    readonly updateMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Profile updated" });
    });

    readonly deleteMe = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Account deleted" });
    });
}

export default AuthController;
