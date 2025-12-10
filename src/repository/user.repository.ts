import { eq } from "drizzle-orm";
import { db } from "../config/config.db";
import { usersTable } from "../config/db/user.table";
import type { userRegisterData } from "../utils/userData";
import { password } from "bun";

class UserRepository {

    async getUserByEmail(email: string): Promise<{ id: string; email: string; password_hash: string; role: 'user' | 'venue_owner' | 'admin' } | undefined> {
        return (await db.select({
            id: usersTable.id,
            email: usersTable.email,
            password_hash: usersTable.password_hash,
            role: usersTable.role,
        }).from(usersTable).where(eq(usersTable.email, email)))[0];
    }

    async getUserById(id: string) {
        return (await db.select().from(usersTable).where(eq(usersTable.id, id)))[0];
    }

    async createUser(userData: userRegisterData) {
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
}

export default UserRepository;