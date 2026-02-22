interface AppleJwk {
    kty: string;
    kid: string;
    use?: string;
    alg?: string;
    n: string;
    e: string;
}

interface AppleJwksResponse {
    keys?: AppleJwk[];
}

interface AppleTokenHeader {
    alg?: string;
    kid?: string;
}

interface AppleTokenClaims {
    iss?: string;
    aud?: string | string[];
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: string | boolean;
    is_private_email?: string | boolean;
}

export interface AppleProfile {
    sub: string;
    email?: string;
    emailVerified: boolean;
    isPrivateEmail: boolean;
}

const APPLE_KEYS_ENDPOINT = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_ALGORITHM = "RS256";
const APPLE_KEYS_CACHE_MS = 60 * 60 * 1000;

let cachedAppleKeys: AppleJwk[] | null = null;
let cachedAppleKeysExpiresAt = 0;

function getAllowedAppleClientIds(): string[] {
    const envClientIds = [
        process.env.APPLE_CLIENT_ID,
        process.env.APPLE_IOS_CLIENT_ID,
        process.env.APPLE_SERVICE_ID,
        ...(process.env.APPLE_CLIENT_IDS?.split(",") || []),
    ]
        .map((id) => id?.trim())
        .filter((id): id is string => !!id);

    return [...new Set(envClientIds)];
}

function decodeBase64UrlToBytes(value: string): Uint8Array {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return Uint8Array.from(Buffer.from(padded, "base64"));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function decodeJwtSegment<T>(segment: string): T {
    try {
        const bytes = decodeBase64UrlToBytes(segment);
        const text = new TextDecoder().decode(bytes);
        return JSON.parse(text) as T;
    } catch {
        throw new Error("APPLE_TOKEN_INVALID");
    }
}

function parseBooleanClaim(value?: string | boolean): boolean {
    return value === true || value === "true";
}

async function getAppleKeys(): Promise<AppleJwk[]> {
    if (cachedAppleKeys && Date.now() < cachedAppleKeysExpiresAt) {
        return cachedAppleKeys;
    }

    const response = await fetch(APPLE_KEYS_ENDPOINT);
    if (!response.ok) {
        throw new Error("APPLE_KEYS_FETCH_FAILED");
    }

    const payload = (await response.json()) as AppleJwksResponse;
    if (!payload.keys || !Array.isArray(payload.keys) || payload.keys.length === 0) {
        throw new Error("APPLE_KEYS_FETCH_FAILED");
    }

    cachedAppleKeys = payload.keys;
    cachedAppleKeysExpiresAt = Date.now() + APPLE_KEYS_CACHE_MS;
    return payload.keys;
}

async function verifyAppleSignature(idToken: string, header: AppleTokenHeader) {
    const parts = idToken.split(".");
    if (parts.length !== 3) {
        throw new Error("APPLE_TOKEN_INVALID");
    }

    const encodedHeader = parts[0];
    const encodedPayload = parts[1];
    const encodedSignature = parts[2];
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
        throw new Error("APPLE_TOKEN_INVALID");
    }

    const keys = await getAppleKeys();
    const signingKey = keys.find((key) => key.kid === header.kid && key.kty === "RSA");
    if (!signingKey) {
        cachedAppleKeys = null;
        cachedAppleKeysExpiresAt = 0;
        throw new Error("APPLE_SIGNING_KEY_NOT_FOUND");
    }

    const cryptoKey = await crypto.subtle.importKey(
        "jwk",
        {
            kty: signingKey.kty,
            n: signingKey.n,
            e: signingKey.e,
            alg: APPLE_ALGORITHM,
            ext: true,
        },
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256",
        },
        false,
        ["verify"]
    );

    const signedContent = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    const signature = decodeBase64UrlToBytes(encodedSignature);
    const valid = await crypto.subtle.verify(
        { name: "RSASSA-PKCS1-v1_5" },
        cryptoKey,
        toArrayBuffer(signature),
        toArrayBuffer(signedContent)
    );

    if (!valid) {
        throw new Error("APPLE_INVALID_SIGNATURE");
    }
}

export async function verifyAppleIdToken(idToken: string): Promise<AppleProfile> {
    const allowedClientIds = getAllowedAppleClientIds();

    if (allowedClientIds.length === 0) {
        throw new Error("APPLE_OAUTH_NOT_CONFIGURED");
    }

    const segments = idToken.split(".");
    if (segments.length !== 3) {
        throw new Error("APPLE_TOKEN_INVALID");
    }

    const encodedHeader = segments[0];
    const encodedPayload = segments[1];
    if (!encodedHeader || !encodedPayload) {
        throw new Error("APPLE_TOKEN_INVALID");
    }

    const header = decodeJwtSegment<AppleTokenHeader>(encodedHeader);
    if (header.alg !== APPLE_ALGORITHM || !header.kid) {
        throw new Error("APPLE_TOKEN_INVALID");
    }

    await verifyAppleSignature(idToken, header);

    const claims = decodeJwtSegment<AppleTokenClaims>(encodedPayload);

    if (claims.iss !== APPLE_ISSUER) {
        throw new Error("APPLE_INVALID_ISSUER");
    }

    const tokenAudiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const hasValidAudience = tokenAudiences.some(
        (audience): audience is string =>
            typeof audience === "string" && allowedClientIds.includes(audience)
    );

    if (!hasValidAudience) {
        throw new Error("APPLE_INVALID_AUDIENCE");
    }

    const exp = typeof claims.exp === "number" ? claims.exp : Number(claims.exp);
    const now = Math.floor(Date.now() / 1000);
    if (!exp || exp <= now) {
        throw new Error("APPLE_TOKEN_EXPIRED");
    }

    if (!claims.sub) {
        throw new Error("APPLE_SUB_MISSING");
    }

    if (claims.email && !parseBooleanClaim(claims.email_verified)) {
        throw new Error("APPLE_EMAIL_NOT_VERIFIED");
    }

    return {
        sub: claims.sub,
        email: claims.email?.trim() || undefined,
        emailVerified: parseBooleanClaim(claims.email_verified),
        isPrivateEmail: parseBooleanClaim(claims.is_private_email),
    };
}
