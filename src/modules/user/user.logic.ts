import UserRepository from "../../repository/user.repository";
import { FavoritesRepository } from "../../repository/favorites.repository";
import TokenRepository from "../../repository/token.repository";
import { StorageService } from "../../services/storage.service";
import { password as BunPassword } from "bun";
import { mailQueue } from "../../queue/notification.queue";
import { decodeSessionDevice, mergeSessionDevicePreservingLocation } from "../../utils/session-device";
import { EmailType } from "../../types/mail.types";

const parsePositiveDays = (envValue: string | undefined, defaultDays: number): number => {
    const parsed = Number(envValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultDays;
};

/**
 * Service handling Pure Business Logic for Users.
 * No Hono/HTTP dependencies here.
 */
export class UserLogic {
    private readonly sessionInactivityMs =
        parsePositiveDays(process.env.SESSION_INACTIVITY_DAYS, 7) * 24 * 60 * 60 * 1000;
    private readonly accountDeletionGraceDays =
        parsePositiveDays(process.env.ACCOUNT_DELETION_GRACE_DAYS, 30);
    private readonly accountDeletionGraceMs = this.accountDeletionGraceDays * 24 * 60 * 60 * 1000;

    constructor(
        private readonly userRepository: UserRepository,
        private readonly favoritesRepository: FavoritesRepository,
        private readonly tokenRepository: TokenRepository,
        private readonly storageService: StorageService
    ) {}

    /**
     * Get the current user's full profile.
     */
    async getUserProfile(userId: string) {
        const users = await this.userRepository.getMe({ id: userId });
        
        if (!users || users.length === 0) {
            throw new Error("USER_NOT_FOUND");
        }

        const userData = users[0]!;
        const toArray = (value: unknown): string[] =>
            Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
        const authProvider = userData.google_id
            ? "google"
            : userData.apple_id
              ? "apple"
              : "email";
        const sports = toArray(userData.fav_sports);
        const ambiances = toArray(userData.ambiances);
        const venueTypes = toArray(userData.venue_types);
        const needsCompletion = authProvider !== "email" && userData.role === "user";
        const hasCompletedOnboarding =
            !needsCompletion ||
            (Boolean(userData.phone?.trim()) &&
                sports.length > 0 &&
                ambiances.length > 0 &&
                venueTypes.length > 0 &&
                Boolean(userData.budget));

        return {
            id: userData.id,
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            bio: userData.bio,
            phone: userData.phone,
            avatar: this.storageService.getFullUrl(userData.avatar_url),
            role: userData.role,
            auth_provider: authProvider,
            preferences: {
                sports,
                ambiance: ambiances,
                foodTypes: venueTypes,
                budget: userData.budget || "",
            },
            created_at: userData.created_at,
            has_completed_onboarding: hasCompletedOnboarding,
        };
    }

    /**
     * Update the current user's profile.
     */
    async updateUser(
        userId: string,
        data: {
            first_name?: string;
            last_name?: string;
            email?: string;
            phone?: string;
            bio?: string;
            avatar?: string;
            fav_sports?: string[];
            fav_team_ids?: string[];
            ambiances?: string[];
            venue_types?: string[];
            budget?: string;
            home_lat?: number;
            home_lng?: number;
        }
    ) {
        const {
            fav_sports,
            fav_team_ids,
            ambiances,
            venue_types,
            budget,
            home_lat,
            home_lng,
            ...profileUpdates
        } = data;

        if (Object.keys(profileUpdates).length > 0) {
            const updatedUser = await this.userRepository.updateUser(userId, profileUpdates);
            if (!updatedUser) {
                throw new Error("USER_NOT_FOUND");
            }
        } else {
            const existingUser = await this.userRepository.getUserById(userId);
            if (!existingUser) {
                throw new Error("USER_NOT_FOUND");
            }
        }

        const hasPreferencesPatch =
            fav_sports !== undefined ||
            fav_team_ids !== undefined ||
            ambiances !== undefined ||
            venue_types !== undefined ||
            budget !== undefined ||
            home_lat !== undefined ||
            home_lng !== undefined;

        if (hasPreferencesPatch) {
            await this.userRepository.saveUserPreferences(userId, {
                fav_sports,
                fav_team_ids,
                ambiances,
                venue_types,
                budget,
                home_lat,
                home_lng,
            });
        }

        return this.getUserProfile(userId);
    }

    async getNotificationPreferences(userId: string) {
        return await this.userRepository.getNotificationPreferences(userId);
    }

    async updateNotificationPreferences(
        userId: string,
        updates: {
            email_reservations?: boolean;
            email_marketing?: boolean;
            email_updates?: boolean;
            push_reservations?: boolean;
            push_marketing?: boolean;
            push_updates?: boolean;
            sms_reservations?: boolean;
        }
    ) {
        return await this.userRepository.updateNotificationPreferences(userId, updates);
    }

    async getPrivacyPreferences(userId: string) {
        return await this.userRepository.getPrivacyPreferences(userId);
    }

    async updatePrivacyPreferences(
        userId: string,
        updates: {
            analytics_consent?: boolean;
            marketing_consent?: boolean;
            legal_updates_email?: boolean;
        }
    ) {
        return await this.userRepository.updatePrivacyPreferences(userId, updates);
    }
    
    /**
     * Delete user account after verifying password.
     */
    public async deleteUser(userId: string, reason: string, details: string | undefined, password: string) {
        const user = await this.userRepository.getUserById(userId);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }

        const trimmedPassword = typeof password === "string" ? password.trim() : "";
        if (!trimmedPassword) {
            throw new Error("PASSWORD_REQUIRED");
        }

        const isPasswordValid = await BunPassword.verify(trimmedPassword, user.password_hash);
        if (!isPasswordValid) {
            throw new Error("INVALID_PASSWORD");
        }

        await this.userRepository.deleteUser(userId, reason, details);
        await this.tokenRepository.deleteTokensByUserId(userId);

        const reactivationDeadline = new Date(Date.now() + this.accountDeletionGraceMs).toISOString();

        // Best effort email notification, must never block account deletion.
        try {
            await mailQueue.add(EmailType.ACCOUNT_DELETION, {
                to: user.email,
                subject:
                    user.role === "venue_owner"
                        ? `Compte partenaire désactivé (réactivation possible ${this.accountDeletionGraceDays} jours)`
                        : `Compte désactivé (réactivation possible ${this.accountDeletionGraceDays} jours)`,
                data: {
                    userName: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
                    role: user.role,
                    graceDays: this.accountDeletionGraceDays,
                    reactivationDeadline,
                }
            });
        } catch (error) {
            console.error("[USER] Account deletion email enqueue failed:", error);
        }

        return true;
    }
    
    
    async updatePassword(userId: string, data: { current_password?: string; new_password: string }) {
        const user = await this.userRepository.getUserById(userId);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }

        const hasSocialProvider = Boolean(user.google_id || user.apple_id);
        const currentPassword = data.current_password?.trim();

        if (!currentPassword) {
            if (!hasSocialProvider) {
                throw new Error("CURRENT_PASSWORD_REQUIRED");
            }
        } else {
            const isPasswordValid = await BunPassword.verify(currentPassword, user.password_hash);
            if (!isPasswordValid) {
                throw new Error("INVALID_CURRENT_PASSWORD");
            }
        }

        const newPasswordHash = await BunPassword.hash(data.new_password, { algorithm: "bcrypt", cost: 10 });
        await this.userRepository.updateUserPassword(userId, newPasswordHash);

        // Best effort security notification: do not block password update if mail enqueue fails.
        try {
            const userName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email;
            await mailQueue.add(EmailType.PASSWORD_CHANGED, {
                to: user.email,
                subject: "Alerte de sécurité: votre mot de passe a été modifié",
                data: {
                    template: EmailType.PASSWORD_CHANGED,
                    userName,
                    changedAt: new Date().toISOString(),
                    supportEmail: "support@matchapp.fr",
                    text: "Alerte de sécurité: le mot de passe de votre compte Match a été modifié. Si vous ne reconnaissez pas cette activité ou si vous n'êtes pas à l'origine de ce changement, répondez à cet email ou contactez immédiatement support@matchapp.fr.",
                },
            }, {
                removeOnComplete: true,
                attempts: 3,
                backoff: {
                    type: "exponential" as const,
                    delay: 1000,
                },
            });
        } catch (error) {
            console.error("[USER] Password changed email enqueue failed:", error);
        }
        
        return true;
    }

    async getSessions(userId: string, tokenIssuedAt?: number, tokenSessionId?: string) {
        const sessions = await this.getActiveSessions(userId);
        const currentSessionId = this.resolveCurrentSessionId(sessions, tokenIssuedAt, tokenSessionId);

        return sessions
            .sort((a, b) => this.toMs(b.updated_at) - this.toMs(a.updated_at))
            .map((session) => {
                const deviceInfo = decodeSessionDevice(session.device);
                return {
                    id: session.id,
                    device: deviceInfo.userAgent,
                    location: {
                        city: deviceInfo.location.city,
                        region: deviceInfo.location.region,
                        country: deviceInfo.location.country,
                    },
                    created_at: session.created_at,
                    updated_at: session.updated_at,
                    is_current: session.id === currentSessionId,
                };
            });
    }

    async revokeSession(userId: string, sessionId: string) {
        const session = await this.tokenRepository.getTokenById(sessionId);
        if (!session || session.userId !== userId) {
            throw new Error("SESSION_NOT_FOUND");
        }

        await this.tokenRepository.deleteToken(sessionId);
        return true;
    }

    async revokeOtherSessions(userId: string, tokenIssuedAt?: number, tokenSessionId?: string) {
        const sessions = await this.getActiveSessions(userId);
        if (sessions.length === 0) {
            return { revoked: 0, kept_session_id: null as string | null };
        }

        const currentSessionId = this.resolveCurrentSessionId(sessions, tokenIssuedAt, tokenSessionId);
        if (!currentSessionId) {
            const revoked = await this.tokenRepository.deleteTokensByUserId(userId);
            return { revoked, kept_session_id: null as string | null };
        }

        const revoked = await this.tokenRepository.deleteTokensByUserIdExcept(userId, currentSessionId);
        return { revoked, kept_session_id: currentSessionId };
    }

    async touchSessionActivity(
        userId: string,
        tokenIssuedAt?: number,
        tokenSessionId?: string,
        sessionDevice?: string
    ) {
        if (tokenSessionId) {
            let nextSessionDevice = sessionDevice;
            if (sessionDevice) {
                const existingSession = await this.tokenRepository.getTokenById(tokenSessionId);
                if (existingSession && existingSession.userId === userId) {
                    nextSessionDevice = mergeSessionDevicePreservingLocation(
                        existingSession.device,
                        sessionDevice,
                    );
                }
            }

            const touched = await this.tokenRepository.touchSessionById(userId, tokenSessionId, {
                device: nextSessionDevice,
            });
            return touched;
        }

        // Safety: never infer another session to avoid cross-session activity updates.
        return false;
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

    private async getActiveSessions(userId: string) {
        const sessions = await this.tokenRepository.getAllTokensByUserId(userId);
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

        const staleSessionSet = new Set(staleSessionIds);
        return sessions.filter((session) => !staleSessionSet.has(session.id));
    }

    /**
     * Update the user's push notification token.
     */
    async updatePushToken(userId: string, pushToken: string) {
        const updatedUser = await this.userRepository.updateUser(userId, { push_token: pushToken });
        if (!updatedUser) {
            throw new Error("USER_NOT_FOUND");
        }
        return true;
    }

    /**
     * Get user favorites with business-level pagination.
     */
    async getFavorites(userId: string, pagination: { page: number; limit: number }) {
        return await this.favoritesRepository.getFavorites(userId, pagination);
    }
}
