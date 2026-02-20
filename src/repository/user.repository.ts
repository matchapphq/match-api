import { eq } from "drizzle-orm";
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

type AuthUser = {
    id: string;
    email: string;
    password_hash: string;
    role: 'user' | 'venue_owner' | 'admin';
    first_name: string | null;
    last_name: string | null;
};

const toAuthUser = (user: typeof usersTable.$inferSelect): AuthUser => ({
    id: user.id,
    email: user.email,
    password_hash: user.password_hash,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
});

class UserRepository {
    
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
            created_at: usersTable.created_at
        }).from(usersTable).where(eq(usersTable.id, user.id));
    }
    
    public async getUserByEmail(email: string): Promise<AuthUser | undefined> {
        const [user] = await db.select({
            id: usersTable.id,
            email: usersTable.email,
            password_hash: usersTable.password_hash,
            role: usersTable.role,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name
        }).from(usersTable).where(eq(usersTable.email, email));
        return user;
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

    public async syncGoogleUserData(
        userId: string,
        data: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            avatarUrl?: string;
            googleId?: string;
        }
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

    public async updateUser(userId: string, data: { first_name?: string; last_name?: string; email?: string; phone?: string; bio?: string; avatar?: string; push_token?: string }) {
        const { avatar, push_token, ...rest } = data;
        const payload = {
            ...rest,
            ...(avatar ? { avatar_url: avatar } : {}),
            ...(push_token !== undefined ? { push_token } : {}),
            updated_at: new Date()
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
            updated_at: new Date()
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
    
    public async doesUserExist(email: string): Promise<boolean> {
        const user = await this.getUserByEmail(email);
        return !!user;
    }
    
    public async deleteUser(userId: string, reason: string, details?: string): Promise<void> {
        await Promise.all([
            db.delete(usersTable).where(eq(usersTable.id, userId)),
            db.insert(userDeleteReasonsTable).values({
                reason: reason,
                details: details ?? null,
            })
        ]);
    }
}

export default UserRepository;
