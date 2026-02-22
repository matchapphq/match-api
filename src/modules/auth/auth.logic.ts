import { password, randomUUIDv7 } from "bun";
import { JwtUtils, type TokenPayload } from "../../utils/jwt";
import UserRepository from "../../repository/user.repository";
import TokenRepository from "../../repository/token.repository";
import AuthRepository from "../../repository/auth/auth.repository";
import referralRepository, { ReferralRepository } from "../../repository/referral.repository";
import { userOnaboarding } from "./auth.helper";
import { Redis } from "ioredis";
import { mailQueue } from "../../queue/notification.queue";
import type { userRegisterData } from "../../utils/userData";
import { verifyGoogleIdToken } from "../../utils/googleAuth";
import { verifyAppleIdToken } from "../../utils/appleAuth";
import { StorageService } from "../../services/storage.service";

/**
 * Service handling Pure Business Logic for Authentication.
 */
export class AuthLogic {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly tokenRepository: TokenRepository,
        private readonly authRepository: AuthRepository,
        private readonly referralRepo: typeof referralRepository,
        private readonly redis: Redis,
        private readonly storageService: StorageService
    ) {}

    /**
     * Register a new user and return user data + tokens.
     */
    public async register(body: any, deviceId: string) {
        // Check if user already exists
        const existingUser = await this.userRepository.getUserByEmail(body.email);
        if (existingUser) {
            throw new Error("USER_ALREADY_EXISTS");
        }

        const userRequest: userRegisterData = {
            ...body,
            role: (body.role as "user" | "venue_owner" | "admin") || "user",
        };

        const user = await this.userRepository.createUser({
            ...userRequest,
            role: body.role,
        });

        if (!user || !user.first_name) {
            throw new Error("USER_CREATION_FAILED");
        }

        if (body.role === "venue_owner") {
            if (body.referralCode) {
                await this.referralRepo.registerReferral(body.referralCode, user.id).catch(err => {
                    console.error("Referral registration failed:", err);
                });
            }
            await this.enqueueWelcomeEmail(user, "welcome-partner", "/dashboard");
        } else if (body.role === "user") {
            await userOnaboarding(body, this.authRepository, user.id);
            await this.enqueueWelcomeEmail(user, "welcome", "/discovery");
        }

        const tokens = await this.generateAndStoreTokens(user, deviceId);

        return { user, ...tokens };
    }

    /**
     * Authenticate user and return data + tokens.
     */
    async login(body: any, deviceId: string) {
        const user = await this.userRepository.getUserByEmail(body.email);
        if (!user) throw new Error("INVALID_CREDENTIALS");

        const passwordMatch = await password.verify(body.password, user.password_hash);
        if (!passwordMatch) throw new Error("INVALID_CREDENTIALS");

        // Fetch full user to get avatar_url
        const fullUser = await this.userRepository.getUserById(user.id);

        const tokens = await this.generateAndStoreTokens(user, deviceId);

        return {
            user: { 
                id: user.id, 
                email: user.email, 
                role: user.role, 
                first_name: user.first_name,
                last_name: user.last_name,
                avatar: this.storageService.getFullUrl(fullUser?.avatar_url)
            },
            ...tokens
        };
    }

    /**
     * Authenticate user with Google ID token.
     * Creates a user record if no account exists for the Google email.
     */
    async googleLogin(idToken: string, deviceId: string) {
        const googleProfile = await verifyGoogleIdToken(idToken);

        // Only keep fields that map to existing user attributes for now.
        let user = await this.userRepository.getUserByEmail(googleProfile.email);
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            const createdUser = await this.userRepository.createGoogleUser({
                email: googleProfile.email,
                firstName: googleProfile.givenName,
                lastName: googleProfile.familyName,
                phone: googleProfile.phoneNumber,
                avatarUrl: googleProfile.picture,
                googleId: googleProfile.sub,
                role: "user",
            });

            try {
                await this.authRepository.savePreferences(createdUser.id, {
                    ambiances: [],
                    venue_types: [],
                    fav_sports: [],
                    fav_team_ids: [],
                });
            } catch (preferencesError) {
                console.warn("Google signup: unable to save initial preferences", preferencesError);
            }

            user = await this.userRepository.getUserByEmail(googleProfile.email);
        }

        if (!user) throw new Error("USER_CREATION_FAILED");

        await this.userRepository.syncGoogleUserData(user.id, {
            firstName: googleProfile.givenName,
            lastName: googleProfile.familyName,
            phone: googleProfile.phoneNumber,
            avatarUrl: googleProfile.picture,
            googleId: googleProfile.sub,
        });

        // Fetch fresh user data
        const fullUser = await this.userRepository.getUserById(user.id);
        if (!fullUser) throw new Error("USER_CREATION_FAILED");

        const tokens = await this.generateAndStoreTokens(fullUser, deviceId);

        return {
            user: {
                id: fullUser.id,
                email: fullUser.email,
                role: fullUser.role,
                first_name: fullUser.first_name,
                last_name: fullUser.last_name,
                avatar: this.storageService.getFullUrl(fullUser.avatar_url)
            },
            isNewUser,
            ...tokens,
        };
    }

    /**
     * Authenticate user with Apple ID token.
     * Creates a user record on first Apple login when email is present.
     */
    async appleLogin(
        idToken: string,
        deviceId: string,
        profileHints?: {
            firstName?: string;
            lastName?: string;
        }
    ) {
        const appleProfile = await verifyAppleIdToken(idToken);

        const firstName = profileHints?.firstName?.trim() || undefined;
        const lastName = profileHints?.lastName?.trim() || undefined;

        let user = await this.userRepository.getUserByAppleId(appleProfile.sub);
        let isNewUser = false;

        if (!user && appleProfile.email) {
            user = await this.userRepository.getUserByEmail(appleProfile.email);
        }

        if (!user) {
            if (!appleProfile.email) {
                throw new Error("APPLE_EMAIL_REQUIRED_FOR_SIGNUP");
            }

            isNewUser = true;
            user = await this.userRepository.createAppleUser({
                email: appleProfile.email,
                firstName,
                lastName,
                appleId: appleProfile.sub,
                role: "user",
            });

            try {
                await this.authRepository.savePreferences(user.id, {
                    ambiances: [],
                    venue_types: [],
                    fav_sports: [],
                    fav_team_ids: [],
                });
            } catch (preferencesError) {
                console.warn("Apple signup: unable to save initial preferences", preferencesError);
            }
        }

        await this.userRepository.syncAppleUserData(user.id, {
            firstName,
            lastName,
            appleId: appleProfile.sub,
        });

        const fullUser = await this.userRepository.getUserById(user.id);
        if (!fullUser) throw new Error("USER_CREATION_FAILED");

        const tokens = await this.generateAndStoreTokens(fullUser, deviceId);

        return {
            user: {
                id: fullUser.id,
                email: fullUser.email,
                role: fullUser.role,
                first_name: fullUser.first_name,
                last_name: fullUser.last_name,
                avatar: this.storageService.getFullUrl(fullUser.avatar_url),
            },
            isNewUser,
            ...tokens,
        };
    }

    /**
     * Refresh access token using a valid refresh token.
     */
    async refreshToken(oldRefreshToken: string, deviceId: string) {
        const payload = await JwtUtils.verifyRefreshToken(oldRefreshToken);
        if (!payload) throw new Error("INVALID_REFRESH_TOKEN");

        const dbTokens = await this.tokenRepository.getAllTokensByUserId(payload.id);
        if (!dbTokens || dbTokens.length === 0) throw new Error("INVALID_SESSION");

        let matchedToken = null;
        for (const t of dbTokens) {
            const isValid = await password.verify(oldRefreshToken, t.hash_token);
            if (isValid) {
                matchedToken = t;
                break;
            }
        }

        if (!matchedToken) {
            await this.tokenRepository.deleteTokensByUserId(payload.id);
            throw new Error("SESSION_HIJACK_DETECTED");
        }

        const tokens = await this.generateAndStoreTokens(payload, deviceId, matchedToken.id);
        return tokens;
    }

    /**
     * Handle forgot password request.
     */
    async forgotPassword(email: string) {
        const user = await this.userRepository.getUserByEmail(email);
        if (!user) return; // Silent return for security

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redis.set(`RESET_CODE:${email}`, code, "EX", 15 * 60);

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
            backoff: { type: "exponential", delay: 5000 },
            priority: 3,
            jobId: randomUUIDv7() as string,
        });
    }

    /**
     * Verify if the reset code is valid.
     */
    async verifyResetCode(email: string, code: string) {
        const storedCode = await this.redis.get(`RESET_CODE:${email}`);
        if (!storedCode || storedCode !== code) {
            throw new Error("INVALID_RESET_CODE");
        }
        return true;
    }

    /**
     * Reset user password.
     */
    async resetPassword(email: string, code: string, newPassword: string) {
        await this.verifyResetCode(email, code);
        
        const user = await this.userRepository.getUserByEmail(email);
        if (!user) throw new Error("USER_NOT_FOUND");
        
        const passwordHash = await password.hash(newPassword);
        await Promise.all([
            this.userRepository.updateUserPassword(user.id, passwordHash),
            this.redis.del(`RESET_CODE:${email}`)
        ]);
    }

    /**
     * Check if an email exists.
     */
    async validateEmail(email: string) {
        const exists = await this.userRepository.doesUserExist(email);
        if (!exists) throw new Error("USER_NOT_FOUND");
        return true;
    }

    // --- Helpers ---

    private async generateAndStoreTokens(user: any, deviceId: string, tokenIdToUpdate?: string) {
        const tokenPayload: TokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.first_name || user.firstName || null,
        };

        const [accessToken, refreshToken] = await Promise.all([
            JwtUtils.generateAccessToken(tokenPayload),
            JwtUtils.generateRefreshToken(tokenPayload),
        ]);

        if (tokenIdToUpdate) {
            await this.tokenRepository.updateToken(refreshToken, user.id, deviceId, tokenIdToUpdate);
        } else {
            await this.tokenRepository.createToken(refreshToken, user.id, deviceId);
        }

        return { accessToken, refreshToken };
    }

    private async enqueueWelcomeEmail(user: any, template: string, path: string) {
        try {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            await mailQueue.add(template, {
                to: user.email,
                subject: template === "welcome" ? "Welcome to Match!" : "Welcome to Match Partner!",
                data: {
                    userName: user.first_name,
                    actionLink: `${frontendUrl}${path}`
                }
            }, {
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
                priority: 2,
                jobId: `welcome-${user.id}`
            });
        } catch (error) {
            console.error(`Failed to enqueue welcome email (${template}):`, error);
        }
    }
}
