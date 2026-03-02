import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "../config/config.db";
import { userDeleteReasonsTable, userPreferencesTable, usersTable, type NewUserPreferences } from "../config/db/user.table";
import type { userRegisterData } from "../utils/userData";
import { password, randomUUIDv7 } from "bun";

export interface SavePreferencesData {
    ambiances?: string[];
    venue_types?: string[];
    budget?: string;
    home_lat?: number;
    home_lng?: number;
    fav_sports?: string[];
    fav_team_ids?: string[];
}

export interface NotificationPreferences {
    email_reservations: boolean;
    email_modifications: boolean;
    email_cancellations: boolean;
    email_match_reminders: boolean;
    push_reservations: boolean;
    push_updates: boolean;
    sms_new_reservations: boolean;
    sms_cancellations: boolean;
}

export interface UpdateNotificationPreferencesData {
    email_reservations?: boolean;
    email_modifications?: boolean;
    email_cancellations?: boolean;
    email_match_reminders?: boolean;
    push_reservations?: boolean;
    push_updates?: boolean;
    sms_new_reservations?: boolean;
    sms_cancellations?: boolean;
}

export interface PrivacyPreferences {
    analytics_consent: boolean;
    marketing_consent: boolean;
    legal_updates_email: boolean;
}

export interface UpdatePrivacyPreferencesData {
    analytics_consent?: boolean;
    marketing_consent?: boolean;
    legal_updates_email?: boolean;
}

type AuthUser = {
    id: string;
    email: string;
    password_hash: string;
    role: 'user' | 'venue_owner' | 'admin';
    first_name: string | null;
    last_name: string | null;
    deleted_at: Date | null;
    is_active: boolean;
};

const toAuthUser = (user: typeof usersTable.$inferSelect): AuthUser => ({
    id: user.id,
    email: user.email,
    password_hash: user.password_hash,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    deleted_at: user.deleted_at,
    is_active: Boolean(user.is_active),
});

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    email_reservations: true,
    email_modifications: true,
    email_cancellations: true,
    email_match_reminders: true,
    push_reservations: true,
    push_updates: true,
    sms_new_reservations: true,
    sms_cancellations: true,
};

const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
    analytics_consent: false,
    marketing_consent: false,
    legal_updates_email: true,
};

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const asBoolean = (value: unknown, fallback: boolean): boolean =>
    typeof value === "boolean" ? value : fallback;

const mergeDefinedBooleanUpdates = <T extends object>(
    current: T,
    updates: Partial<T>,
): T => {
    const next = { ...current };

    for (const key of Object.keys(updates) as Array<keyof T>) {
        const value = updates[key];
        if (typeof value === "boolean") {
            next[key] = value as T[keyof T];
        }
    }

    return next;
};

const normalizeNotificationPreferences = (settings: unknown): NotificationPreferences => {
    const raw = asRecord(settings);

    return {
        email_reservations: asBoolean(raw.email_reservations, DEFAULT_NOTIFICATION_PREFERENCES.email_reservations),
        email_modifications: asBoolean(raw.email_modifications, DEFAULT_NOTIFICATION_PREFERENCES.email_modifications),
        email_cancellations: asBoolean(raw.email_cancellations, DEFAULT_NOTIFICATION_PREFERENCES.email_cancellations),
        email_match_reminders: asBoolean(raw.email_match_reminders, DEFAULT_NOTIFICATION_PREFERENCES.email_match_reminders),
        push_reservations: asBoolean(raw.push_reservations, DEFAULT_NOTIFICATION_PREFERENCES.push_reservations),
        push_updates: asBoolean(raw.push_updates, DEFAULT_NOTIFICATION_PREFERENCES.push_updates),
        sms_new_reservations: asBoolean(raw.sms_new_reservations, DEFAULT_NOTIFICATION_PREFERENCES.sms_new_reservations),
        sms_cancellations: asBoolean(raw.sms_cancellations, DEFAULT_NOTIFICATION_PREFERENCES.sms_cancellations),
    };
};

const normalizePrivacyPreferences = (settings: unknown): PrivacyPreferences => {
    const raw = asRecord(settings);

    return {
        analytics_consent: asBoolean(raw.analytics_consent, DEFAULT_PRIVACY_PREFERENCES.analytics_consent),
        marketing_consent: asBoolean(raw.marketing_consent, DEFAULT_PRIVACY_PREFERENCES.marketing_consent),
        legal_updates_email: asBoolean(raw.legal_updates_email, DEFAULT_PRIVACY_PREFERENCES.legal_updates_email),
    };
};

const mergePreferenceSettings = (
    notifications: NotificationPreferences,
    privacy: PrivacyPreferences,
): Record<string, unknown> => ({
    ...notifications,
    ...privacy,
});

class UserRepository {
    private async getUserPreferenceRow(userId: string) {
        const [preferences] = await db.select({
            id: userPreferencesTable.id,
            notification_settings: userPreferencesTable.notification_settings,
        }).from(userPreferencesTable).where(eq(userPreferencesTable.user_id, userId));

        return preferences ?? null;
    }

    private async upsertPreferenceSettings(userId: string, settings: Record<string, unknown>) {
        const existing = await this.getUserPreferenceRow(userId);
        const payload: Partial<NewUserPreferences> = {
            notification_settings: settings,
            updated_at: new Date(),
        };

        if (existing) {
            await db.update(userPreferencesTable)
                .set(payload)
                .where(eq(userPreferencesTable.id, existing.id));
            return;
        }

        await db.insert(userPreferencesTable).values({
            user_id: userId,
            ...payload,
        } as NewUserPreferences);
    }
    
    public async getMe(user: { id: string }) {
        return await db.select({
            id: usersTable.id,
            email: usersTable.email,
            role: usersTable.role,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
            bio: usersTable.bio,
            phone: usersTable.phone,
            avatar_url: usersTable.avatar_url,
            google_id: usersTable.google_id,
            apple_id: usersTable.apple_id,
            created_at: usersTable.created_at,
            fav_sports: userPreferencesTable.fav_sports,
            fav_team_ids: userPreferencesTable.fav_team_ids,
            ambiances: userPreferencesTable.ambiances,
            venue_types: userPreferencesTable.venue_types,
            budget: userPreferencesTable.budget,
        }).from(usersTable)
            .leftJoin(userPreferencesTable, eq(userPreferencesTable.user_id, usersTable.id))
            .where(eq(usersTable.id, user.id));
    }
    
    public async getUserByEmail(email: string): Promise<AuthUser | undefined> {
        const [user] = await db.select({
            id: usersTable.id,
            email: usersTable.email,
            password_hash: usersTable.password_hash,
            role: usersTable.role,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
            deleted_at: usersTable.deleted_at,
            is_active: usersTable.is_active,
        }).from(usersTable).where(eq(usersTable.email, email));
        if (!user) return undefined;
        return {
            ...user,
            is_active: Boolean(user.is_active),
        };
    }

    public async getUserByAppleId(appleId: string): Promise<AuthUser | undefined> {
        const [user] = await db.select({
            id: usersTable.id,
            email: usersTable.email,
            password_hash: usersTable.password_hash,
            role: usersTable.role,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
            deleted_at: usersTable.deleted_at,
            is_active: usersTable.is_active,
        }).from(usersTable).where(eq(usersTable.apple_id, appleId));
        if (!user) return undefined;
        return {
            ...user,
            is_active: Boolean(user.is_active),
        };
    }

    public async getUserById(id: string) {
        return (await db.select().from(usersTable).where(eq(usersTable.id, id)))[0];
    }

    public async createUser(userData: userRegisterData) {
        const hashed_password = await password.hash(userData.password, { algorithm: "bcrypt", cost: 10 });
        const [createdUser] = await db.insert(usersTable).values({
            email: userData.email,
            password_hash: hashed_password,
            username: userData.username || null,
            first_name: userData.firstName,
            last_name: userData.lastName,
            bio: userData.bio || null,
            phone: userData.phone || null,
            role: userData.role || "user",
        }).returning();

        if (!createdUser) {
            throw new Error("User creation failed");
        }

        return toAuthUser(createdUser);
    }

    public async createGoogleUser(data: {
        email: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        avatarUrl?: string;
        googleId?: string;
        role?: 'user' | 'venue_owner' | 'admin';
    }) {
        const generatedPassword = `google-oauth-${randomUUIDv7()}`;
        const hashedPassword = await password.hash(generatedPassword, { algorithm: "bcrypt", cost: 10 });

        const [createdUser] = await db.insert(usersTable).values({
            email: data.email,
            password_hash: hashedPassword,
            username: null,
            first_name: data.firstName ?? null,
            last_name: data.lastName ?? null,
            phone: data.phone ?? null,
            avatar_url: data.avatarUrl ?? null,
            role: data.role ?? "user",
            is_verified: true,
            google_id: data.googleId ?? null,
        }).returning();

        if (!createdUser) throw new Error("User creation failed");
        return toAuthUser(createdUser);
    }

    public async createAppleUser(data: {
        email: string;
        firstName?: string;
        lastName?: string;
        appleId: string;
        role?: 'user' | 'venue_owner' | 'admin';
    }) {
        const generatedPassword = `apple-oauth-${randomUUIDv7()}`;
        const hashedPassword = await password.hash(generatedPassword, { algorithm: "bcrypt", cost: 10 });

        const [createdUser] = await db.insert(usersTable).values({
            email: data.email,
            password_hash: hashedPassword,
            username: null,
            first_name: data.firstName ?? null,
            last_name: data.lastName ?? null,
            role: data.role ?? "user",
            is_verified: true,
            apple_id: data.appleId,
        }).returning();

        if (!createdUser) throw new Error("User creation failed");
        return toAuthUser(createdUser);
    }

    public async syncGoogleUserData(
        userId: string,
        data: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            avatarUrl?: string;
            googleId?: string;
        },
    ) {
        const now = new Date();

        const payload: {
            username: null;
            first_name?: string;
            last_name: string | null;
            phone?: string;
            avatar_url?: string;
            is_verified: true;
            google_id?: string;
            updated_at: Date;
        } = {
            username: null,
            last_name: data.lastName ?? null,
            is_verified: true,
            updated_at: now,
        };

        if (data.firstName) payload.first_name = data.firstName;
        if (data.phone) payload.phone = data.phone;
        if (data.avatarUrl) payload.avatar_url = data.avatarUrl;
        if (data.googleId) payload.google_id = data.googleId;

        await db.update(usersTable).set(payload).where(eq(usersTable.id, userId));
    }

    public async syncAppleUserData(
        userId: string,
        data: {
            firstName?: string;
            lastName?: string;
            appleId: string;
        },
    ) {
        const now = new Date();

        const payload: {
            username: null;
            first_name?: string;
            is_verified: true;
            apple_id: string;
            updated_at: Date;
            last_name?: string;
        } = {
            username: null,
            is_verified: true,
            apple_id: data.appleId,
            updated_at: now,
        };

        if (data.firstName) payload.first_name = data.firstName;
        if (data.lastName) payload.last_name = data.lastName;

        await db.update(usersTable).set(payload).where(eq(usersTable.id, userId));
    }

    public async updateUser(userId: string, data: { first_name?: string; last_name?: string; email?: string; phone?: string; bio?: string; avatar?: string; push_token?: string }) {
        const { avatar, push_token, ...rest } = data;
        const payload = {
            ...rest,
            ...(avatar ? { avatar_url: avatar } : {}),
            ...(push_token !== undefined ? { push_token } : {}),
            updated_at: new Date(),
        };

        const [updatedUser] = await db.update(usersTable)
            .set(payload)
            .where(eq(usersTable.id, userId))
            .returning();

        return updatedUser;
    }

    public async updateUserPassword(userId: string, passwordHash: string) {
        return (await db.update(usersTable)
            .set({ password_hash: passwordHash, updated_at: new Date() })
            .where(eq(usersTable.id, userId))
            .returning())[0];
    }
    
    public async saveUserPreferences(userId: string, preferences: SavePreferencesData) {

        const [existing] = await db.select({
            id: userPreferencesTable.id,
        }).from(userPreferencesTable).where(eq(userPreferencesTable.user_id, userId));

        const preferenceData: Partial<NewUserPreferences> = {
            home_lat: preferences.home_lat ?? undefined,
            home_lng: preferences.home_lng ?? undefined,
            fav_sports: preferences.fav_sports ?? undefined,
            fav_team_ids: preferences.fav_team_ids ?? undefined,
            ambiances: preferences.ambiances ?? undefined,
            venue_types: preferences.venue_types ?? undefined,
            budget: preferences.budget ?? undefined,
            updated_at: new Date(),
        };

        if (existing) {
            return (await db.update(userPreferencesTable)
                .set(preferenceData)
                .where(eq(userPreferencesTable.id, existing.id))
                .returning())[0];
        } else {
            return (await db.insert(userPreferencesTable).values({
                user_id: userId,
                ...preferenceData,
            } as NewUserPreferences).returning())[0];
        }
    }

    public async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
        const existing = await this.getUserPreferenceRow(userId);
        return normalizeNotificationPreferences(existing?.notification_settings);
    }

    public async updateNotificationPreferences(
        userId: string,
        updates: UpdateNotificationPreferencesData,
    ): Promise<NotificationPreferences> {
        const existing = await this.getUserPreferenceRow(userId);
        const existingSettings = asRecord(existing?.notification_settings);
        const nextNotifications = mergeDefinedBooleanUpdates(
            normalizeNotificationPreferences(existingSettings),
            updates,
        );

        const nextPrivacy = normalizePrivacyPreferences(existingSettings);
        const mergedSettings = mergePreferenceSettings(nextNotifications, nextPrivacy);
        await this.upsertPreferenceSettings(userId, mergedSettings);

        return nextNotifications;
    }

    public async getPrivacyPreferences(userId: string): Promise<PrivacyPreferences> {
        const existing = await this.getUserPreferenceRow(userId);
        return normalizePrivacyPreferences(existing?.notification_settings);
    }

    public async updatePrivacyPreferences(
        userId: string,
        updates: UpdatePrivacyPreferencesData,
    ): Promise<PrivacyPreferences> {
        const existing = await this.getUserPreferenceRow(userId);
        const existingSettings = asRecord(existing?.notification_settings);

        const nextNotifications = normalizeNotificationPreferences(existingSettings);
        const nextPrivacy = mergeDefinedBooleanUpdates(
            normalizePrivacyPreferences(existingSettings),
            updates,
        );

        const mergedSettings = mergePreferenceSettings(nextNotifications, nextPrivacy);
        await this.upsertPreferenceSettings(userId, mergedSettings);

        return nextPrivacy;
    }
    
    public async doesUserExist(email: string): Promise<boolean> {
        const user = await this.getUserByEmail(email);
        return !!user;
    }
    
    public async deleteUser(userId: string, reason: string, details?: string): Promise<void> {
        const softDeletedUsers = await db
            .update(usersTable)
            .set({
                deleted_at: new Date(),
                is_active: false,
                updated_at: new Date(),
            })
            .where(eq(usersTable.id, userId))
            .returning();

        if (softDeletedUsers.length === 0) {
            throw new Error("USER_NOT_FOUND");
        }

        try {
            await db.insert(userDeleteReasonsTable).values({
                reason: reason,
                details: details ?? null,
            });
        } catch (error) {
            console.error("[USER_REPOSITORY] Failed to store deletion reason:", error);
        }
    }

    public async reactivateUser(userId: string): Promise<boolean> {
        const reactivatedUsers = await db
            .update(usersTable)
            .set({
                deleted_at: null,
                is_active: true,
                updated_at: new Date(),
            })
            .where(eq(usersTable.id, userId))
            .returning();

        return reactivatedUsers.length > 0;
    }

    public async deleteUserPermanentlyById(userId: string): Promise<boolean> {
        const deletedUsers = await db
            .delete(usersTable)
            .where(eq(usersTable.id, userId))
            .returning();

        return deletedUsers.length > 0;
    }

    public async purgeDeletedUsersBefore(cutoffDate: Date): Promise<number> {
        const deletedUsers = await db
            .delete(usersTable)
            .where(and(isNotNull(usersTable.deleted_at), lte(usersTable.deleted_at, cutoffDate)))
            .returning();

        return deletedUsers.length;
    }
}

export default UserRepository;
