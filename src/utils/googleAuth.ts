interface GoogleTokenInfoResponse {
    aud?: string;
    email?: string;
    email_verified?: string;
    exp?: string;
    given_name?: string;
    family_name?: string;
    name?: string;
    picture?: string;
    iss?: string;
    sub?: string;
    phone_number?: string;
}

export interface GoogleProfile {
    email: string;
    givenName?: string;
    familyName?: string;
    picture?: string;
    sub?: string;
    phoneNumber?: string;
}

const GOOGLE_TOKEN_INFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo";

function getAllowedGoogleClientIds(): string[] {
    const envClientIds = [
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        ...(process.env.GOOGLE_CLIENT_IDS?.split(",") || []),
    ]
        .map((id) => id?.trim())
        .filter((id): id is string => !!id);

    return [...new Set(envClientIds)];
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
    const allowedClientIds = getAllowedGoogleClientIds();

    if (allowedClientIds.length === 0) {
        throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");
    }

    const response = await fetch(
        `${GOOGLE_TOKEN_INFO_ENDPOINT}?id_token=${encodeURIComponent(idToken)}`
    );

    if (!response.ok) {
        throw new Error("GOOGLE_TOKEN_INVALID");
    }

    const payload = (await response.json()) as GoogleTokenInfoResponse;

    if (!payload.aud || !allowedClientIds.includes(payload.aud)) {
        throw new Error("GOOGLE_INVALID_AUDIENCE");
    }

    const validIssuer =
        payload.iss === "accounts.google.com" ||
        payload.iss === "https://accounts.google.com";
    if (!validIssuer) {
        throw new Error("GOOGLE_INVALID_ISSUER");
    }

    if (!payload.email || payload.email_verified !== "true") {
        throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
    }

    const exp = payload.exp ? Number(payload.exp) : 0;
    const now = Math.floor(Date.now() / 1000);
    if (!exp || exp <= now) {
        throw new Error("GOOGLE_TOKEN_EXPIRED");
    }

    const derivedName = payload.name?.trim() || "";
    const [derivedFirstName = "", ...derivedLastNameParts] = derivedName.split(" ");
    const derivedLastName = derivedLastNameParts.join(" ").trim();

    return {
        email: payload.email.trim(),
        givenName: payload.given_name?.trim() || derivedFirstName || undefined,
        familyName: payload.family_name?.trim() || derivedLastName || undefined,
        picture: payload.picture,
        sub: payload.sub,
        phoneNumber: payload.phone_number?.trim() || undefined,
    };
}
