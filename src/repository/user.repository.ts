import { eq } from "drizzle-orm";
import { db } from "../config/config.db";
import { user_preferences, userTable } from "../config/db/user.table";
import type { userRegisterData } from "../utils/userData";
import { password } from "bun";

class UserRepository {

    async getUserByEmail(email: string): Promise<{ id: string; email: string; password_hash: string} | undefined> {
        return (await db.select({
            id: userTable.id,
            email: userTable.email,
            password_hash: userTable.password_hash,
        }).from(userTable).where(eq(userTable.email, email)))[0];
    }

    async getUserById(id: string) {
        return (await db.select().from(userTable).where(eq(userTable.id, id)))[0];
    }

    async createUser(userData: userRegisterData) {
        // Create user
        const hashed_password = await password.hash(userData.password, { algorithm: "bcrypt", cost: 10 });
        const user = await db.insert(userTable).values({
            email: userData.email,
            password_hash: hashed_password,
            username: userData.username,
            lastName: userData.lastName,
            firstName: userData.firstName,
            phone: userData.phone,
        }).returning({ 
            id: userTable.id, 
            email: userTable.email, 
        });
        
        // Handle failed user creation
        if (!user || user.length === 0) {
            throw new Error("User creation failed");
        }
    
        // Create preferences if data exists
        if ((userData.favSports || userData.favTeamIds || userData.homeLat || userData.homeLng) && user[0]) {
            await db.insert(user_preferences).values({
                user_id: user[0].id,
                homeLat: userData.homeLat,
                homeLng: userData.homeLng,
                favSports: userData.favSports,
                favTeamIds: userData.favTeamIds,
            });
        }
    
        return user[0];
    }
}

export default UserRepository;