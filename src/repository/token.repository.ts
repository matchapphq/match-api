import { tokenTable } from "../config/db/token.table";
import { db } from "../config/config.db";
import { eq } from "drizzle-orm";
import { password } from "bun";

class TokenRepository {
    async createToken(token: string, userId: string, device: string): Promise<{ user_id: string }[]> {   
        let _tokenReturn
        const hashedToken = await password.hash(token, 'bcrypt');

        try {
            _tokenReturn = await db.insert(tokenTable).values({
                hash_token: hashedToken,
                userId: userId,
                device: device,
            }).returning({
                user_id: tokenTable.userId,
            });
            if (!_tokenReturn) {
                throw new Error("Token not created");
            }
            return _tokenReturn;
        } catch (error) {
            throw new Error("Failed to create token");
        }
    }

    async getTokenByToken(token: string) {
        return (await db.select().from(tokenTable).where(eq(tokenTable.hash_token, token)))[0];
    }

    async getTokenByUserId(userId: string) {
        return (await db.select().from(tokenTable).where(eq(tokenTable.userId, userId)))[0];
    }

    async getAllTokensByUserId(userId: string) {
        return await db.select().from(tokenTable).where(eq(tokenTable.userId, userId));
    }

    async updateToken(token: string, userId: string, device: string, sessionId: string) {
        const hashedToken = await password.hash(token, 'bcrypt');

        const updatedToken = await db.update(tokenTable).set({
            hash_token: hashedToken,
            userId: userId,
            device: device,
        }).where(eq(tokenTable.id, sessionId)).returning({
            id: tokenTable.id,
        });
        if (!updatedToken) {
            throw new Error("Token not found");
        }
        return updatedToken;
    }

    async deleteToken(sessionId: string): Promise<void> {
        await db.delete(tokenTable).where(eq(tokenTable.id, sessionId));
    }

    async deleteTokensByUserId(userId: string): Promise<void> {
        await db.delete(tokenTable).where(eq(tokenTable.userId, userId));
    }

    async verifyToken(userID: string, token: string): Promise<boolean> {
        const dbTokens = await this.getAllTokensByUserId(userID);
        if (!dbTokens || dbTokens.length === 0) {
            throw new Error("Token not found");
        }

        for (const t of dbTokens) {
            const isTokenValid = await password.verify(token, t.hash_token);
            if (isTokenValid) {
                return true;
            }
        }

        throw new Error("Invalid token");
    }
}

export default TokenRepository;