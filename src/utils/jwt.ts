import { sign, verify } from "hono/jwt";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "access_secret";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "refresh_secret";

// Token expiry times
const ACCESS_TOKEN_EXPIRY = 60 * 15; // 24 hours (in seconds)
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 30; // 7 days

export type TokenPayload = {
    id: string;
    email: string;
    firstName: string | null;
    role: "user" | "venue_owner" | "admin";
}

export class JwtUtils {
    public static readonly ACCESS_TOKEN_EXP = ACCESS_TOKEN_EXPIRY;
    public static readonly REFRESH_TOKEN_EXP = REFRESH_TOKEN_EXPIRY;
    public static readonly ACCESS_JWT_SIGN_KEY = process.env.ACCESS_JWT_SIGN_KEY!;
    public static readonly REFRESH_JWT_SIGN_KEY = process.env.REFRESH_JWT_SIGN_KEY!;

    static async generateAccessToken(payload: TokenPayload): Promise<string> {
        if (!Bun.env.SECRET_KEY) {
            throw new Error("SECRET_KEY environment variable is not defined");
        }
        try {
            return await sign({
                ...payload,
                exp: Math.floor(Date.now() / 1000) + this.ACCESS_TOKEN_EXP,
                iat: Math.floor(Date.now() / 1000)
            }, Bun.env.SECRET_KEY, "HS256");
        } catch (error) {
            console.error("Error generating access token:", error);
            throw error;
        }
    }

    static async generateRefreshToken(payload: TokenPayload): Promise<string> {
        if (!Bun.env.REFRESH_SECRET_KEY) {
            throw new Error("REFRESH_SECRET_KEY environment variable is not defined");
        }
        try {
            return await sign({
                ...payload,
                exp: Math.floor(Date.now() / 1000) + this.REFRESH_TOKEN_EXP,
                iat: Math.floor(Date.now() / 1000)
            }, Bun.env.REFRESH_SECRET_KEY, "HS256");
        } catch (error) {
            console.error("Error generating refresh token:", error);
            throw error;
        }
    }

    static async verifyAccessToken(token: string): Promise<TokenPayload | null> {
        if (!Bun.env.SECRET_KEY) {
            throw new Error("SECRET_KEY environment variable is not defined");
        }
        try {
            const payload = await verify(token, Bun.env.SECRET_KEY, "HS256") as TokenPayload;
            return payload;
        } catch (error) {
            console.error("Error verifying access token:", error);
            return null;
        }
    }

    static async verifyRefreshToken(token: string): Promise<TokenPayload | null> {
        if (!Bun.env.REFRESH_SECRET_KEY) {
            throw new Error("REFRESH_SECRET_KEY environment variable is not defined");
        }
        try {
            return await verify(token, Bun.env.REFRESH_SECRET_KEY, "HS256") as TokenPayload;
        } catch (error) {
            console.error("Error verifying refresh token:", error);
            return null;
        }
    }
}