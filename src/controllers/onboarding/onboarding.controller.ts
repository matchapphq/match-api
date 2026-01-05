import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import OnboardingRepository from "../../repository/onboarding.repository";
import UserRepository from "../../repository/user.repository";
import { RegisterRequestSchema } from "../../utils/auth.valid";
import { JwtUtils } from "../../utils/jwt";
import { setSignedCookie } from "hono/cookie";
import type { userRegisterData } from "../../utils/userData";

/**
 * Controller for User Onboarding flow.
 * Handles fetching options (sports, ambiances) and saving user preferences.
 */
class OnboardingController {
    private readonly factory = createFactory();
    private readonly repository = new OnboardingRepository();
    private readonly userRepository = new UserRepository();

    readonly complete = this.factory.createHandlers(
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
                role: "user",
            };

            try {
                const user = await this.userRepository.createUser(userRequest);
                if (!user || !user.id) {
                    return ctx.json({ error: "Failed to create user" }, 500);
                }

                // Save preferences
                await this.repository.savePreferences(user.id, body);

                // Generate Tokens
                const tokenPayload = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    firstName: user.first_name || "",
                };

                const [accessToken, refreshToken] = await Promise.all([
                    JwtUtils.generateAccessToken(tokenPayload),
                    JwtUtils.generateRefreshToken(tokenPayload),
                ]);

                await Promise.all([
                    setSignedCookie(
                        ctx,
                        "refresh_token",
                        refreshToken,
                        JwtUtils.REFRESH_JWT_SIGN_KEY!,
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
                        JwtUtils.ACCESS_JWT_SIGN_KEY!,
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
                console.error("Onboarding error:", error);
                return ctx.json({ error: "Onboarding failed" }, 500);
            }
        },
    );
}

export default OnboardingController;
