import { sign, verify } from "hono/jwt";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "access_secret";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "refresh_secret";

// Token expiry times
const ACCESS_TOKEN_EXPIRY = 60 * 60 * 24; // 24 hours (in seconds)
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 7; // 7 days

export const generateAccessToken = async (payload: object) => {
    const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY;
    return await sign({ ...payload, exp }, ACCESS_TOKEN_SECRET);
};

export const generateRefreshToken = async (payload: object) => {
    const exp = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXPIRY;
    return await sign({ ...payload, exp }, REFRESH_TOKEN_SECRET);
};

export const verifyAccessToken = async (token: string) => {
    try {
        return await verify(token, ACCESS_TOKEN_SECRET);
    } catch (e) {
        return null;
    }
};

export const verifyRefreshToken = async (token: string) => {
    try {
        return await verify(token, REFRESH_TOKEN_SECRET);
    } catch (e) {
        return null;
    }
};
