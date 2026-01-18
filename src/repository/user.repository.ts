import { eq } from "drizzle-orm";
import { db } from "../config/config.db";
import { userPreferencesTable, usersTable, type NewUserPreferences } from "../config/db/user.table";
import type { userRegisterData } from "../utils/userData";
import { password } from "bun";

export interface SavePreferencesData {
    ambiances?: string[];
    venue_types?: string[];
    budget?: string;
    home_lat?: number;
    home_lng?: number;
    fav_sports?: string[];
    fav_team_ids?: string[];
}

class UserRepository {
    
    public async getMe(user: { id: string }) {
        return await db.select({
            id: usersTable.id,
            email: usersTable.email,
            role: usersTable.role,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
            phone: usersTable.phone
        }).from(usersTable).where(eq(usersTable.id, user.id));
    }
    
    public async getUserByEmail(email: string): Promise<{ id: string; email: string; password_hash: string; role: 'user' | 'venue_owner' | 'admin'; first_name: string | null; } | undefined> {
        return (await db.select({
            id: usersTable.id,
            email: usersTable.email,
            password_hash: usersTable.password_hash,
            role: usersTable.role,
            first_name: usersTable.first_name
        }).from(usersTable).where(eq(usersTable.email, email)))[0];
    }

    public async getUserById(id: string) {
        return (await db.select().from(usersTable).where(eq(usersTable.id, id)))[0];
    }

    public async createUser(userData: userRegisterData) {
        // Create user
        const hashed_password = await password.hash(userData.password, { algorithm: "bcrypt", cost: 10 });
        const [newUser] = await db.insert(usersTable).values({
            email: userData.email,
            password_hash: hashed_password,
            first_name: userData.firstName,
            last_name: userData.lastName,
            role: userData.role || 'user',
            phone: userData.phone,
        }).returning();

        // Handle failed user creation
        if (!newUser) {
            throw new Error("User creation failed");
        }

        return newUser;
    }
    
    public async saveUserPreferences(userId: string, preferences: SavePreferencesData) {

        const existing = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.user_id, userId));

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

        if (existing.length > 0 && existing[0]) {
            return (await db.update(userPreferencesTable)
                .set(preferenceData)
                .where(eq(userPreferencesTable.id, existing[0].id))
                .returning())[0];
        } else {
            return (await db.insert(userPreferencesTable).values({
                user_id: userId,
                ...preferenceData,
            } as NewUserPreferences).returning())[0];
        }
    }
}

export default UserRepository;