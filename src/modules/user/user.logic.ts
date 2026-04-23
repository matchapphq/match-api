import UserRepository, { type PartnerOnboardingStep } from "../../repository/user.repository";
import { FavoritesRepository } from "../../repository/favorites.repository";
import TokenRepository from "../../repository/token.repository";
import { PartnerRepository } from "../../repository/partner/partner.repository";
import { StorageService } from "../../services/storage.service";
import { password as BunPassword } from "bun";
import { queueEmailIfAllowed } from "../../services/mail-dispatch.service";
import { decodeSessionDevice, mergeSessionDevicePreservingLocation } from "../../utils/session-device";
import { EmailType } from "../../types/mail.types";
import { mapToClientUserProfile } from "../../utils/user-profile";
import type { ClientUserProfile } from "../../types/user-profile.types";
import { resolveHasPaymentMethodLive } from "../../utils/stripe-payment-method";
import { FidelityLogic } from "../fidelity/fidelity.logic";
import stripe from "../../config/stripe";

const parsePositiveDays = (envValue: string | undefined, defaultDays: number): number => {
    const parsed = Number(envValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultDays;
};

/**
 * Service handling Pure Business Logic for Users.
 * No Hono/HTTP dependencies here.
 */
export class UserLogic {
    private readonly partnerRepository = new PartnerRepository();

    private readonly sessionInactivityMs =
        parsePositiveDays(process.env.SESSION_INACTIVITY_DAYS, 7) * 24 * 60 * 60 * 1000;
    private readonly accountDeletionGraceDays =
        parsePositiveDays(process.env.ACCOUNT_DELETION_GRACE_DAYS, 30);
    private readonly accountDeletionGraceMs = this.accountDeletionGraceDays * 24 * 60 * 60 * 1000;

    constructor(
        private readonly userRepository: UserRepository,
        private readonly favoritesRepository: FavoritesRepository,
        private readonly tokenRepository: TokenRepository,
        private readonly storageService: StorageService,
        private readonly fidelityLogic: FidelityLogic = new FidelityLogic(),
    ) {}

    private async resolvePartnerOnboardingStep(
        userId: string,
        hasPaymentMethod: boolean,
    ): Promise<PartnerOnboardingStep> {
        if (hasPaymentMethod) {
            return "done";
        }

        const venueCount = await this.userRepository.getOwnedVenueCount(userId);
        if (venueCount > 0) {
            const savedStep = await this.userRepository.getPartnerOnboardingStep(userId);
            return savedStep === "paiement_method_skipped" ? "paiement_method_skipped" : "paiement_method";
        }

        return "first_venue";
    }

    /**
     * Get the current user's full profile.
     */
    async getUserProfile(userId: string): Promise<ClientUserProfile> {
        const users = await this.userRepository.getMe({ id: userId });
        
        if (!users || users.length === 0) {
            throw new Error("USER_NOT_FOUND");
        }

        const userData = users[0]!;
        const baseProfile = mapToClientUserProfile(
            userData,
            this.storageService.getFullUrl(userData.avatar_url),
        );

        const hasPaymentMethod = await resolveHasPaymentMethodLive(
            userData.stripe_customer_id,
        );

        if (baseProfile.role === "venue_owner" && hasPaymentMethod) {
            try {
                await this.partnerRepository.activatePendingVenuesByOwner(userId);
            } catch (error) {
                console.warn(
                    `[UserLogic] Unable to activate pending venues for user ${userId} after payment method detection:`,
                    error,
                );
            }
        }

        const onboardingStep =
            baseProfile.role === "venue_owner"
                ? await this.resolvePartnerOnboardingStep(userId, hasPaymentMethod)
                : baseProfile.has_completed_onboarding
                    ? "done"
                    : null;
        const hasCompletedVenueOwnerOnboarding =
            hasPaymentMethod ||
            onboardingStep === "paiement_method_skipped" ||
            onboardingStep === "done";

        return {
            ...baseProfile,
            has_payment_method: hasPaymentMethod,
            has_completed_onboarding:
                baseProfile.role === "venue_owner"
                    ? hasCompletedVenueOwnerOnboarding
                    : baseProfile.has_completed_onboarding,
            onboarding_step: onboardingStep,
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
            onboarding_step?: PartnerOnboardingStep;
        },
    ) {
        const {
            fav_sports,
            fav_team_ids,
            ambiances,
            venue_types,
            budget,
            home_lat,
            home_lng,
            onboarding_step,
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

        if (onboarding_step !== undefined && onboarding_step !== null) {
            await this.userRepository.setPartnerOnboardingStep(userId, onboarding_step);
        }

        const fullProfile = await this.getUserProfile(userId);
        
        // Beta Challenge: Profile Completed (+1 but)
        // Requis: Bio + Avatar + Fav Sports
        if (fullProfile.bio && fullProfile.avatar && fullProfile.preferences.sports.length > 0) {
            await this.fidelityLogic.awardPoints({
                userId,
                actionKey: "BETA_PROFILE_COMPLETED",
                referenceId: userId,
                referenceType: "user"
            }).catch(err => console.error("[BetaChallenge] Profile completion failed:", err));
        }

        return fullProfile;
    }

    async getNotificationPreferences(userId: string) {
        return await this.userRepository.getNotificationPreferences(userId);
    }

    async updateNotificationPreferences(
        userId: string,
        updates: {
            email_reservations?: boolean;
            email_modifications?: boolean;
            email_cancellations?: boolean;
            email_match_reminders?: boolean;
            push_reservations?: boolean;
            push_updates?: boolean;
            sms_new_reservations?: boolean;
            sms_cancellations?: boolean;
        },
    ) {
        return await this.userRepository.updateNotificationPreferences(userId, updates);
    }

    async getPrivacyPreferences(userId: string) {
        const preferences = await this.userRepository.getPrivacyPreferences(userId);
        return {
            ...preferences,
            account_deletion_grace_days: this.accountDeletionGraceDays,
        };
    }

    async updatePrivacyPreferences(
        userId: string,
        updates: {
            analytics_consent?: boolean;
            marketing_consent?: boolean;
            legal_updates_email?: boolean;
        },
    ) {
        const preferences = await this.userRepository.updatePrivacyPreferences(userId, updates);
        return {
            ...preferences,
            account_deletion_grace_days: this.accountDeletionGraceDays,
        };
    }
    
    /**
     * Delete user account after verifying password.
     */
    public async deleteUser(userId: string, reason: string, details: string | undefined, password: string) {
        const user = await this.userRepository.getUserById(userId);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }

        const rawPassword = typeof password === "string" ? password : "";
        const isUserRole = user.role === "user";
        const hasSocialProvider = Boolean(user.google_id || user.apple_id);

        // Only bypass password for role 'user' with social auth
        const shouldBypassPassword = isUserRole && hasSocialProvider;

        if (!shouldBypassPassword) {
            if (!rawPassword.trim()) {
                throw new Error("PASSWORD_REQUIRED");
            }

            const isPasswordValid = await BunPassword.verify(rawPassword, user.password_hash);
            if (!isPasswordValid) {
                throw new Error("INVALID_PASSWORD");
            }
        }
        
        // Cancel stripe subscriptions ONLY for 'user' role as requested
        if (isUserRole && user.stripe_customer_id) {
            try {
                const subscriptions = await stripe.subscriptions.list({
                    customer: user.stripe_customer_id,
                    status: 'active',
                });
                for (const sub of subscriptions.data) {
                    await stripe.subscriptions.cancel(sub.id);
                }
            } catch (err) {
                console.error("[USER] Failed to cancel stripe subscriptions for user:", err);
            }
        }

        await this.userRepository.deleteUser(userId, reason, details);
        await this.tokenRepository.deleteTokensByUserId(userId);

        const reactivationDeadline = new Date(Date.now() + this.accountDeletionGraceMs).toISOString();

        // Best effort email notification, must never block account deletion.
        try {
            await queueEmailIfAllowed({
                jobName: EmailType.ACCOUNT_DELETION,
                recipientUserId: user.id,
                isTransactional: true,
                payload: {
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
                    },
                },
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
        const currentPassword = typeof data.current_password === "string" ? data.current_password : "";

        if (!currentPassword.trim()) {
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
            await queueEmailIfAllowed({
                jobName: EmailType.PASSWORD_CHANGED,
                recipientUserId: user.id,
                isTransactional: true,
                payload: {
                    to: user.email,
                    subject: "Alerte de sécurité: votre mot de passe a été modifié",
                    data: {
                        template: EmailType.PASSWORD_CHANGED,
                        userName,
                        changedAt: new Date().toISOString(),
                        supportEmail: "support@matchapp.fr",
                        text: "Alerte de sécurité: le mot de passe de votre compte Match a été modifié. Si vous ne reconnaissez pas cette activité ou si vous n'êtes pas à l'origine de ce changement, répondez à cet email ou contactez immédiatement support@matchapp.fr.",
                    },
                },
                options: {
                    removeOnComplete: true,
                    attempts: 3,
                    backoff: {
                        type: "exponential" as const,
                        delay: 1000,
                    },
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
        sessionDevice?: string,
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
        tokenSessionId?: string,
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
                Math.abs(this.toMs(b.updated_at) - issuedAtMs),
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
