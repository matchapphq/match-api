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
import { EmailType } from "../../types/mail.types";

const parsePositiveDays = (envValue: string | undefined, defaultDays: number): number => {
    const parsed = Number(envValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultDays;
};

/**
 * Service handling Pure Business Logic for Authentication.
 */
export class AuthLogic {
    private readonly sessionInactivityMs =
        parsePositiveDays(process.env.SESSION_INACTIVITY_DAYS, 7) * 24 * 60 * 60 * 1000;
    private readonly accountDeletionGraceDays =
        parsePositiveDays(process.env.ACCOUNT_DELETION_GRACE_DAYS, 30);
    private readonly accountDeletionGraceMs = this.accountDeletionGraceDays * 24 * 60 * 60 * 1000;

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
    public async register(body: any, sessionDevice: string) {
        await this.purgeExpiredDeletedAccounts();

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

        const tokens = await this.generateAndStoreTokens(user, sessionDevice);

        return { user, ...tokens };
    }

    /**
     * Authenticate user and return data + tokens.
     */
    async login(body: any, sessionDevice: string) {
        await this.purgeExpiredDeletedAccounts();

        const user = await this.userRepository.getUserByEmail(body.email);
        if (!user) throw new Error("INVALID_CREDENTIALS");

        if (this.isDeletionExpired(user.deleted_at)) {
            await this.userRepository.deleteUserPermanentlyById(user.id).catch(() => undefined);
            throw new Error("INVALID_CREDENTIALS");
        }

        const passwordMatch = await password.verify(body.password, user.password_hash);
        if (!passwordMatch) throw new Error("INVALID_CREDENTIALS");

        let wasReactivated = false;
        if (user.deleted_at) {
            wasReactivated = await this.userRepository.reactivateUser(user.id);
        }

        const tokens = await this.generateAndStoreTokens(user, sessionDevice);
        if (wasReactivated) {
            await this.enqueueWelcomeBackEmail(user);
        }

        return {
            user: await this.getClientUser(user.id),
            ...tokens
        };
    }

    /**
     * Authenticate user with Google ID token.
     * Creates a user record if no account exists for the Google email.
     */
    async googleLogin(idToken: string, sessionDevice: string) {
        await this.purgeExpiredDeletedAccounts();

        const googleProfile = await verifyGoogleIdToken(idToken);

        // Only keep fields that map to existing user attributes for now.
        let user = await this.userRepository.getUserByEmail(googleProfile.email);
        let isNewUser = false;

        if (user && this.isDeletionExpired(user.deleted_at)) {
            await this.userRepository.deleteUserPermanentlyById(user.id).catch(() => undefined);
            user = undefined;
        }

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

        let wasReactivated = false;
        if (user.deleted_at) {
            wasReactivated = await this.userRepository.reactivateUser(user.id);
        }

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

        const tokens = await this.generateAndStoreTokens(fullUser, sessionDevice);
        if (wasReactivated) {
            await this.enqueueWelcomeBackEmail({
                ...user,
                first_name: fullUser.first_name,
                last_name: fullUser.last_name,
                role: fullUser.role,
            });
        }

        return {
            user: await this.getClientUser(fullUser.id),
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
        sessionDevice: string,
        profileHints?: {
            firstName?: string;
            lastName?: string;
        }
    ) {
        await this.purgeExpiredDeletedAccounts();

        const appleProfile = await verifyAppleIdToken(idToken);

        const firstName = profileHints?.firstName?.trim() || undefined;
        const lastName = profileHints?.lastName?.trim() || undefined;

        let user = await this.userRepository.getUserByAppleId(appleProfile.sub);
        let isNewUser = false;

        if (user && this.isDeletionExpired(user.deleted_at)) {
            await this.userRepository.deleteUserPermanentlyById(user.id).catch(() => undefined);
            user = undefined;
        }

        if (!user && appleProfile.email) {
            user = await this.userRepository.getUserByEmail(appleProfile.email);
            if (user && this.isDeletionExpired(user.deleted_at)) {
                await this.userRepository.deleteUserPermanentlyById(user.id).catch(() => undefined);
                user = undefined;
            }
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

        let wasReactivated = false;
        if (user.deleted_at) {
            wasReactivated = await this.userRepository.reactivateUser(user.id);
        }

        await this.userRepository.syncAppleUserData(user.id, {
            firstName,
            lastName,
            appleId: appleProfile.sub,
        });

        const fullUser = await this.userRepository.getUserById(user.id);
        if (!fullUser) throw new Error("USER_CREATION_FAILED");

        const tokens = await this.generateAndStoreTokens(fullUser, sessionDevice);
        if (wasReactivated) {
            await this.enqueueWelcomeBackEmail({
                ...user,
                first_name: fullUser.first_name,
                last_name: fullUser.last_name,
                role: fullUser.role,
            });
        }

        return {
            user: await this.getClientUser(fullUser.id),
            isNewUser,
            ...tokens,
        };
    }

    /**
     * Refresh access token using a valid refresh token.
     */
    async refreshToken(oldRefreshToken: string, sessionDevice: string) {
        const payload = await JwtUtils.verifyRefreshToken(oldRefreshToken);
        if (!payload) throw new Error("INVALID_REFRESH_TOKEN");

        const dbTokens = await this.tokenRepository.getAllTokensByUserId(payload.id);
        if (!dbTokens || dbTokens.length === 0) throw new Error("INVALID_SESSION");

        const activeSessions = await this.filterActiveSessions(payload.id, dbTokens);
        if (activeSessions.length === 0) {
            throw new Error("SESSION_EXPIRED_INACTIVE");
        }

        let matchedToken = null as (typeof activeSessions)[number] | null;

        if (payload.sid) {
            const sidSession = dbTokens.find((session) => session.id === payload.sid);
            if (!sidSession) {
                throw new Error("INVALID_SESSION");
            }

            const activeSidSession = activeSessions.find((session) => session.id === payload.sid);
            if (!activeSidSession) {
                throw new Error("SESSION_EXPIRED_INACTIVE");
            }

            const isValid = await password.verify(oldRefreshToken, sidSession.hash_token);
            if (!isValid) {
                await this.tokenRepository.deleteToken(sidSession.id).catch(() => undefined);
                throw new Error("SESSION_HIJACK_DETECTED");
            }

            matchedToken = activeSidSession;
        } else {
            for (const t of activeSessions) {
                const isValid = await password.verify(oldRefreshToken, t.hash_token);
                if (isValid) {
                    matchedToken = t;
                    break;
                }
            }

            if (!matchedToken) {
                for (const t of dbTokens) {
                    const isValid = await password.verify(oldRefreshToken, t.hash_token);
                    if (isValid) {
                        throw new Error("SESSION_EXPIRED_INACTIVE");
                    }
                }

                await this.tokenRepository.deleteTokensByUserId(payload.id).catch(() => undefined);
                throw new Error("SESSION_HIJACK_DETECTED");
            }
        }

        const tokens = await this.generateAndStoreTokens(payload, sessionDevice, matchedToken.id);
        return tokens;
    }

    /**
     * Logout current session by revoking the matching refresh token row.
     * Falls back to nearest session inferred from access token issue time.
     */
    async logout(params: {
        userId?: string;
        refreshToken?: string | null;
        tokenIssuedAt?: number;
        tokenSessionId?: string;
    }) {
        const { userId, refreshToken, tokenIssuedAt, tokenSessionId } = params;
        if (!userId) {
            return { revoked: false };
        }

        const dbSessions = await this.tokenRepository.getAllTokensByUserId(userId);
        const sessions = await this.filterActiveSessions(userId, dbSessions);
        if (!sessions || sessions.length === 0) {
            return { revoked: false };
        }

        if (tokenSessionId) {
            const session = sessions.find((candidate) => candidate.id === tokenSessionId);
            if (session) {
                await this.tokenRepository.deleteToken(session.id);
                return { revoked: true };
            }
        }

        if (refreshToken) {
            for (const session of sessions) {
                const isMatch = await password.verify(refreshToken, session.hash_token);
                if (isMatch) {
                    await this.tokenRepository.deleteToken(session.id);
                    return { revoked: true };
                }
            }
        }

        const inferredSessionId = this.resolveCurrentSessionId(sessions, tokenIssuedAt, tokenSessionId);
        if (!inferredSessionId) {
            return { revoked: false };
        }

        await this.tokenRepository.deleteToken(inferredSessionId);
        return { revoked: true };
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

    private async generateAndStoreTokens(user: any, sessionDevice: string, tokenIdToUpdate?: string) {
        const sessionId = tokenIdToUpdate ?? (randomUUIDv7() as string);
        const tokenPayload: TokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.first_name || user.firstName || null,
            sid: sessionId,
        };

        const [accessToken, refreshToken] = await Promise.all([
            JwtUtils.generateAccessToken(tokenPayload),
            JwtUtils.generateRefreshToken(tokenPayload),
        ]);

        if (tokenIdToUpdate) {
            await this.tokenRepository.updateToken(refreshToken, user.id, sessionDevice, tokenIdToUpdate);
        } else {
            await this.tokenRepository.createToken(refreshToken, user.id, sessionDevice, sessionId);
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

    private async enqueueWelcomeBackEmail(user: {
        id: string;
        email: string;
        first_name?: string | null;
        last_name?: string | null;
        role?: "user" | "venue_owner" | "admin" | string;
    }) {
        try {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const isVenueOwner = user.role === "venue_owner";
            const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
            const displayName = fullName || user.email;

            await mailQueue.add(
                EmailType.WELCOME_BACK,
                {
                    to: user.email,
                    subject: isVenueOwner ? "Bon retour sur Match Partner" : "Bon retour sur Match",
                    data: {
                        template: EmailType.WELCOME_BACK,
                        userName: displayName,
                        role: user.role || "user",
                        ...(isVenueOwner ? { actionLink: `${frontendUrl}/dashboard` } : {}),
                    },
                },
                {
                    attempts: 3,
                    backoff: { type: "exponential", delay: 5000 },
                    priority: 2,
                    jobId: `welcome-back-${user.id}-${Date.now()}`,
                }
            );
        } catch (error) {
            console.error("Failed to enqueue welcome-back email:", error);
        }
    }

    private normalizeStringArray(value: unknown): string[] {
        return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    }

    private resolveCurrentSessionId(
        sessions: Array<{ id: string; updated_at: Date | string }>,
        tokenIssuedAt?: number,
        tokenSessionId?: string
    ): string | null {
        if (sessions.length === 0) return null;

        if (tokenSessionId && sessions.some((session) => session.id === tokenSessionId)) {
            return tokenSessionId;
        }

        if (!tokenIssuedAt) {
            return sessions
                .slice()
                .sort((a, b) => this.toMs(b.updated_at) - this.toMs(a.updated_at))[0]
                ?.id ?? null;
        }

        const issuedAtMs = tokenIssuedAt * 1000;
        return sessions
            .slice()
            .sort((a, b) =>
                Math.abs(this.toMs(a.updated_at) - issuedAtMs) -
                Math.abs(this.toMs(b.updated_at) - issuedAtMs)
            )[0]
            ?.id ?? null;
    }

    private toMs(value: Date | string | null | undefined) {
        if (!value) return 0;
        return value instanceof Date ? value.getTime() : new Date(value).getTime();
    }

    private async filterActiveSessions<T extends { id: string; updated_at: Date | string }>(
        userId: string,
        sessions: T[]
    ): Promise<T[]> {
        if (sessions.length === 0) {
            return sessions;
        }

        const cutoffMs = Date.now() - this.sessionInactivityMs;
        const staleSessionIds = sessions
            .filter((session) => this.toMs(session.updated_at) <= cutoffMs)
            .map((session) => session.id);

        if (staleSessionIds.length > 0) {
            await this.tokenRepository.deleteTokensByIds(staleSessionIds);
        }

        const staleSet = new Set(staleSessionIds);
        return sessions.filter((session) => !staleSet.has(session.id));
    }

    private async purgeExpiredDeletedAccounts() {
        const cutoffDate = new Date(Date.now() - this.accountDeletionGraceMs);
        try {
            await this.userRepository.purgeDeletedUsersBefore(cutoffDate);
        } catch (error) {
            console.error("[AUTH] Unable to purge expired deleted accounts:", error);
        }
    }

    private isDeletionExpired(deletedAt: Date | string | null | undefined) {
        if (!deletedAt) return false;
        return this.toMs(deletedAt) <= Date.now() - this.accountDeletionGraceMs;
    }

    private async getClientUser(userId: string) {
        const rows = await this.userRepository.getMe({ id: userId });
        if (!rows || rows.length === 0) {
            throw new Error("USER_CREATION_FAILED");
        }

        const user = rows[0]!;
        const authProvider = user.google_id
            ? "google"
            : user.apple_id
              ? "apple"
              : "email";

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name,
            phone: user.phone,
            avatar: this.storageService.getFullUrl(user.avatar_url),
            auth_provider: authProvider,
            preferences: {
                sports: this.normalizeStringArray(user.fav_sports),
                ambiance: this.normalizeStringArray(user.ambiances),
                foodTypes: this.normalizeStringArray(user.venue_types),
                budget: user.budget || "",
            },
            created_at: user.created_at,
        };
    }
}
