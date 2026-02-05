import { password, randomUUIDv7 } from "bun";
import { JwtUtils } from "../../utils/jwt";
import { validator } from "hono/validator";
import { createFactory } from "hono/factory";
import type { userRegisterData } from "../../utils/userData";
import UserRepository from "../../repository/user.repository";
import TokenRepository from "../../repository/token.repository";
import {
    setCookie,
    setSignedCookie,
    deleteCookie,
    getSignedCookie,
} from "hono/cookie";
import {
    RegisterRequestSchema,
    LoginRequestSchema,
    ForgotPasswordRequestSchema,
    VerifyResetCodeSchema,
    ResetPasswordSchema,
} from "../../utils/auth.valid";
import referralRepository from "../../repository/referral.repository";
import AuthRepository from "../../repository/auth/auth.repository";
import { userOnaboarding } from "./auth.helper";
import { zValidator } from "@hono/zod-validator"
import { Redis } from "ioredis";
import { redisConnection } from "../../config/redis";
import z from "zod";
import { mailQueue } from "../../queue/notification.queue";

/**
 * Controller for Authentication operations.
 * Handles user registration, login, token refreshing, and profile management.
 */
class AuthController {
    private readonly factory = createFactory();
    private readonly userRepository = new UserRepository();
    private readonly tokenRepository = new TokenRepository();
    private readonly authRepository = new AuthRepository();
    private readonly redis = new Redis({ host: `${process.env.REDIS_HOST}` || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') });

    public readonly register = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const parsed = RegisterRequestSchema.safeParse(value);
            if (!parsed.success) {
                return ctx.json(
                    { error: "Invalid request body", details: parsed.error },
                    401,
                );
            }
            return parsed.data;
        }),
        async (ctx) => {
            const body = ctx.req.valid("json");

            // Check if user already exists
            const existingUser = await this.userRepository.getUserByEmail(
                body.email,
            );
            if (existingUser) {
                return ctx.json(
                    { error: "User with this email already exists" },
                    409,
                );
            }

            const userRequest: userRegisterData = {
                ...body,
                role: (body.role as "user" | "venue_owner" | "admin") || "user",
            };

            try {
                const user = await this.userRepository.createUser({
                    ...userRequest,
                    role: body.role,
                });
                if (!user || !user.first_name) {
                    return ctx.json({ error: "Failed to create user" }, 500);
                }

                if (body.role === "venue_owner") {
                    // Optional referral code handling (non-blocking)
                    if (body.referralCode) {
                        try {
                            const referralResult =
                                await referralRepository.registerReferral(
                                    body.referralCode,
                                    user.id,
                                );
                            if (!referralResult.success) {
                                console.warn(
                                    "Referral registration failed:",
                                    referralResult.error,
                                );
                            }
                        } catch (referralError) {
                            console.error(
                                "Referral registration exception:",
                                referralError,
                            );
                            // Do not block user creation if referral flow fails
                        }
                    }

                    // Send Welcome Email for Venue Owner
                    try {
                        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                        await mailQueue.add("welcome-partner", {
                            to: user.email,
                            subject: "Welcome to Match Partner!",
                            data: {
                                userName: user.first_name,
                                actionLink: `${frontendUrl}/dashboard`
                            }
                        }, {
                            attempts: 3,
                            backoff: { type: "exponential", delay: 5000 },
                            priority: 2,
                            jobId: `welcome-${user.id}`
                        });
                    } catch (error) {
                         console.error("Failed to enqueue welcome email for venue_owner:", error);
                    }

                } else if (body.role === "user") {
                    await userOnaboarding(body, this.authRepository, user.id);

                    // Send Welcome Email for User
                    try {
                        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                        await mailQueue.add("welcome", {
                            to: user.email,
                            subject: "Welcome to Match!",
                            data: {
                                userName: user.first_name,
                                actionLink: `${frontendUrl}/discovery`
                            }
                        }, {
                            attempts: 3,
                            backoff: { type: "exponential", delay: 5000 },
                            priority: 2,
                            jobId: `welcome-${user.id}`
                        });
                    } catch (error) {
                         console.error("Failed to enqueue welcome email for user:", error);
                    }
                }

                // Generate Tokens
                const tokenPayload = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    firstName: user.first_name,
                };

                const deviceId = ctx.req.header("User-Agent") || "Unknown";

                const [accessToken, refreshToken] = await Promise.all([
                    JwtUtils.generateAccessToken(tokenPayload),
                    JwtUtils.generateRefreshToken(tokenPayload),
                ]);

                await this.tokenRepository.createToken(
                    refreshToken,
                    user.id,
                    deviceId,
                );

                await Promise.all([
                    setSignedCookie(
                        ctx,
                        "refresh_token",
                        refreshToken,
                        JwtUtils.REFRESH_JWT_SIGN_KEY,
                        {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === "production",
                            sameSite: "Strict",
                            path: "/auth/refresh",
                            maxAge: JwtUtils.REFRESH_TOKEN_EXP,
                        },
                    ),
                    setSignedCookie(
                        ctx,
                        "access_token",
                        accessToken,
                        JwtUtils.ACCESS_JWT_SIGN_KEY,
                        {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === "production",
                            sameSite: "Strict",
                            path: "/",
                            maxAge: JwtUtils.ACCESS_TOKEN_EXP,
                        },
                    ),
                ]);

                return ctx.json({ user, token: accessToken }, 201);
            } catch (error) {
                console.error("Registration error:", error);
                return ctx.json({ error: "Registration failed" }, 500);
            }
        },
    );

    public readonly login = this.factory.createHandlers(
        validator("json", (value, ctx) => {
            const parsed = LoginRequestSchema.safeParse(value);
            if (!parsed.success) {
                return ctx.json(
                    { error: "Invalid request body", details: parsed.error },
                    400,
                );
            }
            return parsed.data;
        }),
        async (ctx) => {
            const body = ctx.req.valid("json");
            const user = await this.userRepository.getUserByEmail(body.email);

            if (!user) {
                return ctx.json({ error: "Invalid email or password" }, 401);
            }

            const passwordMatch = await password.verify(
                body.password,
                user.password_hash,
            );
            if (!passwordMatch) {
                return ctx.json({ error: "Invalid email or password" }, 401);
            }

            const tokenPayload = {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.first_name,
            };

            const [accessToken, refreshToken] = await Promise.all([
                JwtUtils.generateAccessToken(tokenPayload),
                JwtUtils.generateRefreshToken(tokenPayload),
            ]);

            const deviceId = ctx.req.header("User-Agent") || "Unknown";

            await this.tokenRepository.createToken(
                refreshToken,
                user.id,
                deviceId,
            );

            await Promise.all([
                setSignedCookie(
                    ctx,
                    "access_token",
                    accessToken,
                    JwtUtils.ACCESS_JWT_SIGN_KEY,
                    {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === "production",
                        sameSite: "Strict",
                        path: "/",
                        maxAge: JwtUtils.ACCESS_TOKEN_EXP,
                    },
                ),
                setSignedCookie(
                    ctx,
                    "refresh_token",
                    refreshToken,
                    JwtUtils.REFRESH_JWT_SIGN_KEY,
                    {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === "production",
                        sameSite: "Strict",
                        path: "/auth/refresh",
                        maxAge: JwtUtils.REFRESH_TOKEN_EXP,
                    },
                ),
            ]);

        return ctx.json({
            user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name },
            token: accessToken,
            refresh_token: refreshToken
        });
    });

    public readonly refreshToken = this.factory.createHandlers(async (ctx) => {
        let oldRefreshToken = await getSignedCookie(
            ctx,
            JwtUtils.REFRESH_JWT_SIGN_KEY,
            "refresh_token",
        );

        if (!oldRefreshToken) {
            try {
                const body = await ctx.req.json();
                oldRefreshToken = body.refresh_token;
            } catch (e) {
                // Ignore json parse error, maybe it was just missing
                console.error("Invalid request body:", e);
            }
        }

        if (!oldRefreshToken) {
            return ctx.json({ error: "Refresh token is required" }, 401);
        }

        const payload = await JwtUtils.verifyRefreshToken(oldRefreshToken);
        if (!payload) {
            return ctx.json({ error: "Invalid or expired refresh token" }, 401);
        }

        // Consistency check: Verify token exists in DB and matches
        // We retrieve all tokens for the user and check if any match the provided refresh token.
        const dbTokens = await this.tokenRepository.getAllTokensByUserId(
            payload.id,
        );

        if (!dbTokens || dbTokens.length === 0) {
            // Token claimed to be valid (signature-wise) but no record in DB -> Revoked or invalid state
            return ctx.json({ error: "Invalid session" }, 401);
        }

        let matchedToken = null;
        for (const t of dbTokens) {
            const isValid = await password.verify(
                oldRefreshToken,
                t.hash_token,
            );
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
        const newPayload = {
            id: payload.id,
            email: payload.email,
            role: payload.role,
            firstName: payload.firstName,
        };
        const [newAccessToken, newRefreshToken] = await Promise.all([
            JwtUtils.generateAccessToken(newPayload),
            JwtUtils.generateRefreshToken(newPayload),
        ]);

        // Update the existing token record (the matched one)
        const deviceId =
            ctx.req.header("User-Agent") || matchedToken.device || "Unknown";
        await this.tokenRepository.updateToken(
            newRefreshToken,
            payload.id,
            deviceId,
            matchedToken.id,
        );

        setCookie(ctx, "refresh_token", newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/auth/refresh",
            maxAge: JwtUtils.REFRESH_TOKEN_EXP,
        });

        ctx.header("Authorization", `Bearer ${newAccessToken}`);

        return ctx.json({
            token: newAccessToken,
            refresh_token: newRefreshToken,
        });
    });

    public readonly logout = this.factory.createHandlers(async (ctx) => {
        // In JWT stateless auth, logout is client-side.
        // Optional: Blacklist token in Redis if implemented.
        deleteCookie(ctx, "refresh_token");
        deleteCookie(ctx, "access_token");
        return ctx.json({ message: "Logged out successfully" });
    });
    
    public readonly forgotPassword = this.factory.createHandlers(zValidator("json", ForgotPasswordRequestSchema), async (ctx) => {
        const { email } = ctx.req.valid("json");
        
        const user = await this.userRepository.getUserByEmail(email);
        if (!user) {
            // Return success even if user not found to prevent enumeration
            return ctx.json({ message: "If the email exists, a code has been sent." });
        }
        
        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store in Redis with 15 minutes expiration
        await this.redis.set(`RESET_CODE:${email}`, code, "EX", 15 * 60);
        
        try {
            await mailQueue.add("forgot-password", {
                to: email,
                data: {
                    firstName: user.first_name,
                    lastName: user.last_name,
                    subject: "Reset Password",
                    code,
                }
            }, {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 5000
                },
                priority: 3,
                jobId: randomUUIDv7() as string,
            });
        } catch (error) {
            console.error("Failed to send reset email:", error);
            // In a real scenario, we might want to alert monitoring but still return success or appropriate error
            return ctx.json({ error: "Failed to send email" }, 500);
        }
        
        return ctx.json({ message: "If the email exists, a code has been sent." });
    });

    public readonly verifyResetCode = this.factory.createHandlers(zValidator("json", VerifyResetCodeSchema), async (ctx) => {
        const { email, code } = ctx.req.valid("json");
        
        const storedCode = await this.redis.get(`RESET_CODE:${email}`);
        
        if (!storedCode || storedCode !== code) {
            return ctx.json({ error: "Invalid or expired code" }, 400);
        }
        
        return ctx.json({ valid: true });
    });

    public readonly resetPassword = this.factory.createHandlers(zValidator("json", ResetPasswordSchema), async (ctx) => {
        const { email, code, new_password } = ctx.req.valid("json");
        
        const storedCode = await this.redis.get(`RESET_CODE:${email}`);
        
        if (!storedCode || storedCode !== code) {
            return ctx.json({ error: "Invalid or expired code" }, 400);
        }
        
        const user = await this.userRepository.getUserByEmail(email);
        if (!user) {
            return ctx.json({ error: "User not found" }, 404);
        }
        
        try {
            const passwordHash = await password.hash(new_password);
    
            await Promise.all([
                this.userRepository.updateUserPassword(user.id, passwordHash),
                this.redis.del(`RESET_CODE:${email}`)
            ]);

            return ctx.json({ message: "Password reset successfully" });
        } catch (error) {
            console.error("Password reset error:", error);
            return ctx.json({ error: "Failed to reset password" }, 500);
        }
    });
    
    public readonly validateEmail = this.factory.createHandlers(zValidator("json", z.object(
        {
            email: z.email().min(5).max(255)
        }
    )), async (ctx) => {
        const { email } = ctx.req.valid("json");
        
        const user = await this.userRepository.doesUserExist(email);
        if (!user) {
            return ctx.json({ error: "User not found" }, 404);
        }
        
        return ctx.json({ message: "Email is valid" }, 200);
    });

    /**
     * Google Sign-In (Mobile/Client-side)
     * The mobile app handles the Google login and sends the user profile data here.
     */
    public readonly googleSignIn = this.factory.createHandlers(
        zValidator("json", z.object({
            google_id: z.string(),
            email: z.string().email(),
            first_name: z.string(),
            last_name: z.string(),
            avatar_url: z.string().url().optional(),
        })),
        async (ctx) => {
            const body = ctx.req.valid("json");

            try {
                // Find or create user in DB
                const user = await this.userRepository.findOrCreateByGoogleId({
                    google_id: body.google_id,
                    email: body.email,
                    first_name: body.first_name,
                    last_name: body.last_name,
                    avatar_url: body.avatar_url
                });

                if (!user) {
                    return ctx.json({ error: "Failed to process user data" }, 500);
                }

                // Generate Match tokens
                const tokenPayload = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    firstName: user.first_name,
                };

                const deviceId = ctx.req.header("User-Agent") || "Unknown-Mobile";
                const [accessToken, refreshToken] = await Promise.all([
                    JwtUtils.generateAccessToken(tokenPayload),
                    JwtUtils.generateRefreshToken(tokenPayload),
                ]);

                await this.tokenRepository.createToken(refreshToken, user.id, deviceId);

                return ctx.json({
                    user: { 
                        id: user.id, 
                        email: user.email, 
                        role: user.role, 
                        first_name: user.first_name,
                        last_name: user.last_name,
                        avatar_url: user.avatar_url
                    },
                    token: accessToken,
                    refresh_token: refreshToken
                });
            } catch (err: any) {
                console.error("Google Mobile Sign-In Error:", err);
                return ctx.json({ error: "Internal server error during Google Sign-In" }, 500);
            }
        }
    );

    /**
     * Google OAuth Login Redirect
     */
    public readonly googleLogin = this.factory.createHandlers(async (ctx) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
        
        const params = new URLSearchParams({
            client_id: clientId!,
            redirect_uri: callbackUrl!,
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            prompt: 'select_account'
        });

        return ctx.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    });

    /**
     * Google OAuth Callback
     */
    public readonly googleCallback = this.factory.createHandlers(async (ctx) => {
        const code = ctx.req.query('code');
        const error = ctx.req.query('error');

        if (error) {
            return ctx.json({ error: "Google OAuth error", details: error }, 400);
        }

        if (!code) {
            return ctx.json({ error: "No code provided" }, 400);
        }

        try {
            // Exchange code for tokens
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                    redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
                    grant_type: 'authorization_code'
                })
            });

            const tokens = await tokenResponse.json();
            
            if (tokens.error) {
                return ctx.json({ error: "Token exchange failed", details: tokens.error_description }, 400);
            }

            // Get user info
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });

            const googleUser = await userResponse.json();

            // Find or create user in DB
            const user = await this.userRepository.findOrCreateByGoogleId({
                google_id: googleUser.sub,
                email: googleUser.email,
                first_name: googleUser.given_name,
                last_name: googleUser.family_name,
                avatar_url: googleUser.picture
            });

            if (!user) {
                return ctx.json({ error: "Failed to process user data" }, 500);
            }

            // Generate Match tokens
            const tokenPayload = {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.first_name,
            };

            const deviceId = ctx.req.header("User-Agent") || "Unknown";
            const [accessToken, refreshToken] = await Promise.all([
                JwtUtils.generateAccessToken(tokenPayload),
                JwtUtils.generateRefreshToken(tokenPayload),
            ]);

            await this.tokenRepository.createToken(refreshToken, user.id, deviceId);

            // Set cookies and redirect to frontend
            await Promise.all([
                setSignedCookie(ctx, "access_token", accessToken, JwtUtils.ACCESS_JWT_SIGN_KEY, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "Strict",
                    path: "/",
                    maxAge: JwtUtils.ACCESS_TOKEN_EXP,
                }),
                setSignedCookie(ctx, "refresh_token", refreshToken, JwtUtils.REFRESH_JWT_SIGN_KEY, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "Strict",
                    path: "/auth/refresh",
                    maxAge: JwtUtils.REFRESH_TOKEN_EXP,
                }),
            ]);

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            return ctx.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
        } catch (err: any) {
            console.error("Google Callback Error:", err);
            return ctx.json({ error: "Internal server error during OAuth" }, 500);
        }
    });
}

export default AuthController;
