import { tokenTable } from "../config/db/token.table";
import { db } from "../config/config.db";
import { and, eq, inArray, ne } from "drizzle-orm";
import { password } from "bun";

class TokenRepository {
    async createToken(token: string, userId: string, device: string, sessionId?: string): Promise<void> {
        const hashedToken = await password.hash(token, 'bcrypt');

        try {
            await db.insert(tokenTable).values({
                ...(sessionId ? { id: sessionId } : {}),
                hash_token: hashedToken,
                userId: userId,
                device: device,
            });
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

    async getTokenById(sessionId: string) {
        return (
            await db
                .select({
                    id: tokenTable.id,
                    userId: tokenTable.userId,
                    device: tokenTable.device,
                    updated_at: tokenTable.updated_at,
                })
                .from(tokenTable)
                .where(eq(tokenTable.id, sessionId))
        )[0] ?? null;
    }

    async getAllTokensByUserId(userId: string) {
        return await db.select().from(tokenTable).where(eq(tokenTable.userId, userId));
    }

    async updateToken(token: string, userId: string, device: string, sessionId: string): Promise<void> {
        const hashedToken = await password.hash(token, 'bcrypt');
        const existingSession = await this.getTokenById(sessionId);
        if (!existingSession) {
            throw new Error("Token not found");
        }

        // Refresh-token rotation should not count as user activity.
        // Preserve `updated_at`; real activity is tracked by explicit heartbeat touches.
        await db.update(tokenTable).set({
            hash_token: hashedToken,
            userId: userId,
            device: device,
            updated_at: existingSession.updated_at,
        }).where(eq(tokenTable.id, sessionId));
    }

    async deleteToken(sessionId: string): Promise<void> {
        await db.delete(tokenTable).where(eq(tokenTable.id, sessionId));
    }

    async deleteTokensByIds(sessionIds: string[]): Promise<number> {
        if (sessionIds.length === 0) {
            return 0;
        }

        const deletedTokens = await db
            .delete(tokenTable)
            .where(inArray(tokenTable.id, sessionIds))
            .returning();

        return deletedTokens.length;
    }

    async touchSessionById(
        userId: string,
        sessionId: string,
        updates?: { device?: string },
    ): Promise<boolean> {
        const session = await this.getTokenById(sessionId);
        if (!session || session.userId !== userId) {
            return false;
        }

        await db
            .update(tokenTable)
            .set({
                updated_at: new Date(),
                ...(updates?.device ? { device: updates.device } : {}),
            })
            .where(eq(tokenTable.id, session.id));

        return true;
    }

    async deleteTokensByUserId(userId: string): Promise<number> {
        const existingTokens = await db
            .select({ id: tokenTable.id })
            .from(tokenTable)
            .where(eq(tokenTable.userId, userId));

        if (existingTokens.length === 0) {
            return 0;
        }

        await db
            .delete(tokenTable)
            .where(eq(tokenTable.userId, userId));

        return existingTokens.length;
    }

    async deleteTokensByUserIdExcept(userId: string, sessionId: string): Promise<number> {
        const existingTokens = await db
            .select({ id: tokenTable.id })
            .from(tokenTable)
            .where(and(eq(tokenTable.userId, userId), ne(tokenTable.id, sessionId)));

        if (existingTokens.length === 0) {
            return 0;
        }

        await db
            .delete(tokenTable)
            .where(and(eq(tokenTable.userId, userId), ne(tokenTable.id, sessionId)));

        return existingTokens.length;
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
