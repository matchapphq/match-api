import { createFactory } from "hono/factory";
import { JwtUtils } from "../../utils/jwt";
import { setSignedCookie, deleteCookie, getSignedCookie, setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { validator } from "hono/validator";
import {
    RegisterRequestSchema,
    LoginRequestSchema,
    GoogleLoginRequestSchema,
    AppleLoginRequestSchema,
    ForgotPasswordRequestSchema,
    VerifyResetCodeSchema,
    ResetPasswordSchema,
} from "../../utils/auth.valid";
import { AuthLogic } from "./auth.logic";
import z from "zod";
import type { Context } from "hono";

/**
 * Controller for Authentication operations.
 * Handles HTTP concerns (cookies, response mapping).
 */
class AuthController {
    private readonly factory = createFactory();

    constructor(private readonly authLogic: AuthLogic) {}

    private async setAuthCookies(ctx: Context, accessToken: string, refreshToken: string) {
        const isProd = process.env.NODE_ENV === "production";
        
        await Promise.all([
            setSignedCookie(ctx, "access_token", accessToken, JwtUtils.ACCESS_JWT_SIGN_KEY, {
                httpOnly: true,
                secure: isProd,
                sameSite: "Strict",
                path: "/",
                maxAge: JwtUtils.ACCESS_TOKEN_EXP,
            }),
            setSignedCookie(ctx, "refresh_token", refreshToken, JwtUtils.REFRESH_JWT_SIGN_KEY, {
                httpOnly: true,
                secure: isProd,
                sameSite: "Strict",
                path: "/auth/refresh",
                maxAge: JwtUtils.REFRESH_TOKEN_EXP,
            }),
        ]);
    }

    public readonly register = this.factory.createHandlers(
        zValidator("json", RegisterRequestSchema),
        async (ctx) => {
            const body = ctx.req.valid("json");
            const deviceId = ctx.req.header("User-Agent") || "Unknown";

            try {
                const { user, accessToken, refreshToken } = await this.authLogic.register(body, deviceId);
                await this.setAuthCookies(ctx, accessToken, refreshToken);
                
                return ctx.json({ user, token: accessToken }, 201);
            } catch (error: any) {
                if (error.message === "USER_ALREADY_EXISTS") {
                    return ctx.json({ error: "User with this email already exists" }, 409);
                }
                console.error("Registration error:", error);
                return ctx.json({ error: "Registration failed" }, 500);
            }
        }
    );

    public readonly login = this.factory.createHandlers(
        zValidator("json", LoginRequestSchema),
        async (ctx) => {
            const body = ctx.req.valid("json");
            const deviceId = ctx.req.header("User-Agent") || "Unknown";

            try {
                const { user, accessToken, refreshToken } = await this.authLogic.login(body, deviceId);
                await this.setAuthCookies(ctx, accessToken, refreshToken);

                return ctx.json({ user, token: accessToken, refresh_token: refreshToken });
            } catch (error: any) {
                if (error.message === "INVALID_CREDENTIALS") {
                    return ctx.json({ error: "Invalid email or password" }, 401);
                }
                console.error("Login error:", error);
                return ctx.json({ error: "Login failed" }, 500);
            }
        }
    );

    public readonly googleLogin = this.factory.createHandlers(
        zValidator("json", GoogleLoginRequestSchema),
        async (ctx) => {
            const { id_token } = ctx.req.valid("json");
            const deviceId = ctx.req.header("User-Agent") || "Unknown";

            try {
                const { user, accessToken, refreshToken, isNewUser } = await this.authLogic.googleLogin(
                    id_token,
                    deviceId
                );

                await this.setAuthCookies(ctx, accessToken, refreshToken);

                return ctx.json({
                    user,
                    token: accessToken,
                    refresh_token: refreshToken,
                    is_new_user: isNewUser,
                });
            } catch (error: any) {
                if (error.message === "GOOGLE_OAUTH_NOT_CONFIGURED") {
                    return ctx.json({ error: "Google OAuth is not configured on server" }, 500);
                }

                if (
                    [
                        "GOOGLE_TOKEN_INVALID",
                        "GOOGLE_INVALID_AUDIENCE",
                        "GOOGLE_INVALID_ISSUER",
                        "GOOGLE_EMAIL_NOT_VERIFIED",
                        "GOOGLE_TOKEN_EXPIRED",
                    ].includes(error.message)
                ) {
                    return ctx.json({ error: "Invalid Google token" }, 401);
                }

                if (error.message === "GOOGLE_USER_NOT_FOUND") {
                    return ctx.json({ error: "No account found for this Google email" }, 404);
                }

                console.error("Google login error:", error);
                return ctx.json({ error: "Google login failed" }, 500);
            }
        }
    );

    public readonly appleLogin = this.factory.createHandlers(
        zValidator("json", AppleLoginRequestSchema),
        async (ctx) => {
            const { id_token, first_name, last_name } = ctx.req.valid("json");
            const deviceId = ctx.req.header("User-Agent") || "Unknown";

            try {
                const { user, accessToken, refreshToken, isNewUser } = await this.authLogic.appleLogin(
                    id_token,
                    deviceId,
                    {
                        firstName: first_name,
                        lastName: last_name,
                    }
                );

                await this.setAuthCookies(ctx, accessToken, refreshToken);

                return ctx.json({
                    user,
                    token: accessToken,
                    refresh_token: refreshToken,
                    is_new_user: isNewUser,
                });
            } catch (error: any) {
                if (
                    ["APPLE_OAUTH_NOT_CONFIGURED", "APPLE_KEYS_FETCH_FAILED"].includes(error.message)
                ) {
                    return ctx.json({ error: "Apple OAuth is not configured on server" }, 500);
                }

                if (
                    [
                        "APPLE_TOKEN_INVALID",
                        "APPLE_INVALID_SIGNATURE",
                        "APPLE_SIGNING_KEY_NOT_FOUND",
                        "APPLE_INVALID_ISSUER",
                        "APPLE_INVALID_AUDIENCE",
                        "APPLE_TOKEN_EXPIRED",
                        "APPLE_SUB_MISSING",
                        "APPLE_EMAIL_NOT_VERIFIED",
                    ].includes(error.message)
                ) {
                    return ctx.json({ error: "Invalid Apple token" }, 401);
                }

                if (error.message === "APPLE_EMAIL_REQUIRED_FOR_SIGNUP") {
                    return ctx.json({ error: "Apple email is required on first login" }, 400);
                }

                console.error("Apple login error:", error);
                return ctx.json({ error: "Apple login failed" }, 500);
            }
        }
    );

    public readonly refreshToken = this.factory.createHandlers(async (ctx) => {
        let oldToken = await getSignedCookie(ctx, JwtUtils.REFRESH_JWT_SIGN_KEY, "refresh_token");

        if (!oldToken) {
            try {
                const body = await ctx.req.json();
                oldToken = body.refresh_token;
            } catch {}
        }

        if (!oldToken) return ctx.json({ error: "Refresh token is required" }, 401);

        try {
            const deviceId = ctx.req.header("User-Agent") || "Unknown";
            const { accessToken, refreshToken } = await this.authLogic.refreshToken(oldToken, deviceId);
            
            await this.setAuthCookies(ctx, accessToken, refreshToken);
            ctx.header("Authorization", `Bearer ${accessToken}`);

            return ctx.json({ token: accessToken, refresh_token: refreshToken });
        } catch (error: any) {
            const status = error.message === "SESSION_HIJACK_DETECTED" ? 401 : 401;
            return ctx.json({ error: error.message }, status);
        }
    });

    public readonly logout = this.factory.createHandlers(async (ctx) => {
        deleteCookie(ctx, "refresh_token");
        deleteCookie(ctx, "access_token");
        return ctx.json({ message: "Logged out successfully" });
    });

    public readonly forgotPassword = this.factory.createHandlers(
        zValidator("json", ForgotPasswordRequestSchema), 
        async (ctx) => {
            const { email } = ctx.req.valid("json");
            await this.authLogic.forgotPassword(email);
            return ctx.json({ message: "If the email exists, a code has been sent." });
        }
    );

    public readonly verifyResetCode = this.factory.createHandlers(
        zValidator("json", VerifyResetCodeSchema),
        async (ctx) => {
            const { email, code } = ctx.req.valid("json");
            try {
                await this.authLogic.verifyResetCode(email, code);
                return ctx.json({ valid: true });
            } catch (error: any) {
                return ctx.json({ error: "Invalid or expired code" }, 400);
            }
        }
    );

    public readonly resetPassword = this.factory.createHandlers(
        zValidator("json", ResetPasswordSchema),
        async (ctx) => {
            const { email, code, new_password } = ctx.req.valid("json");
            try {
                await this.authLogic.resetPassword(email, code, new_password);
                return ctx.json({ message: "Password reset successfully" });
            } catch (error: any) {
                const status = error.message === "USER_NOT_FOUND" ? 404 : 400;
                return ctx.json({ error: error.message }, status);
            }
        }
    );

    public readonly validateEmail = this.factory.createHandlers(
        zValidator("json", z.object({ email: z.string().email() })),
        async (ctx) => {
            const { email } = ctx.req.valid("json");
            try {
                await this.authLogic.validateEmail(email);
                return ctx.json({ message: "Email is valid" }, 200);
            } catch (error: any) {
                return ctx.json({ error: "User not found" }, 404);
            }
        }
    );
}

export default AuthController;
