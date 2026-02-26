type SessionLocation = {
    city: string | null;
    region: string | null;
    country: string | null;
};

export type SessionDeviceInfo = {
    userAgent: string;
    ip: string | null;
    location: SessionLocation;
};

const SESSION_DEVICE_PREFIX = "session:v1:";

const sanitize = (value: string | null | undefined): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const stripQuotes = (value: string): string => {
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }
    return value;
};

const firstHeaderValue = (headers: Headers, names: string[]): string | null => {
    for (const name of names) {
        const value = sanitize(headers.get(name));
        if (value) return value;
    }
    return null;
};

const normalizeIp = (rawIp: string | null): string | null => {
    if (!rawIp) return null;

    const candidates = rawIp
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    for (const candidateRaw of candidates) {
        let candidate = stripQuotes(candidateRaw);

        if (candidate.toLowerCase().startsWith("for=")) {
            candidate = stripQuotes(candidate.slice(4).trim());
        }

        if (candidate.startsWith("[") && candidate.includes("]")) {
            const closing = candidate.indexOf("]");
            candidate = candidate.slice(1, closing);
        }

        if (candidate.toLowerCase().startsWith("::ffff:")) {
            candidate = candidate.slice(7);
        }

        const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
        if (ipv4WithPort?.[1]) {
            return sanitize(ipv4WithPort[1]);
        }

        const normalized = sanitize(candidate);
        if (normalized && normalized.toLowerCase() !== "unknown") {
            return normalized;
        }
    }

    return null;
};

const parseForwardedHeader = (forwarded: string | null): string | null => {
    if (!forwarded) return null;
    const entries = forwarded.split(",");

    for (const entry of entries) {
        const parts = entry.split(";");
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed.toLowerCase().startsWith("for=")) continue;
            const value = trimmed.slice(4).trim();
            const normalized = normalizeIp(value);
            if (normalized) return normalized;
        }
    }

    return null;
};

export const encodeSessionDevice = (info: SessionDeviceInfo): string => {
    const payload = {
        ua: info.userAgent,
        ip: info.ip,
        city: info.location.city,
        region: info.location.region,
        country: info.location.country,
    };
    return `${SESSION_DEVICE_PREFIX}${JSON.stringify(payload)}`;
};

export const decodeSessionDevice = (rawDevice: string): SessionDeviceInfo => {
    if (!rawDevice.startsWith(SESSION_DEVICE_PREFIX)) {
        return {
            userAgent: rawDevice,
            ip: null,
            location: { city: null, region: null, country: null },
        };
    }

    try {
        const parsed = JSON.parse(rawDevice.slice(SESSION_DEVICE_PREFIX.length)) as {
            ua?: unknown;
            ip?: unknown;
            city?: unknown;
            region?: unknown;
            country?: unknown;
        };

        return {
            userAgent: sanitize(parsed.ua as string | undefined) || "Unknown",
            ip: sanitize(parsed.ip as string | undefined),
            location: {
                city: sanitize(parsed.city as string | undefined),
                region: sanitize(parsed.region as string | undefined),
                country: sanitize(parsed.country as string | undefined),
            },
        };
    } catch {
        return {
            userAgent: rawDevice,
            ip: null,
            location: { city: null, region: null, country: null },
        };
    }
};

export const resolveSessionDeviceFromHeaders = async (
    headers: Headers,
    fallbackUserAgent: string | null | undefined,
): Promise<SessionDeviceInfo> => {
    const userAgent = sanitize(fallbackUserAgent) || "Unknown";
    const ip =
        normalizeIp(
            firstHeaderValue(headers, [
                "x-forwarded-for",
                "cf-connecting-ip",
                "x-real-ip",
                "x-client-ip",
                "x-cluster-client-ip",
                "true-client-ip",
                "fly-client-ip",
            ]),
        ) || parseForwardedHeader(headers.get("forwarded"));

    let city = firstHeaderValue(headers, ["x-vercel-ip-city", "x-geo-city", "x-appengine-city", "cf-ipcity"]);
    let region = firstHeaderValue(headers, [
        "x-vercel-ip-country-region",
        "x-geo-region",
        "x-appengine-region",
        "cf-region",
    ]);
    let country = firstHeaderValue(headers, ["x-vercel-ip-country", "cf-ipcountry", "x-geo-country"]);

    return {
        userAgent,
        ip,
        location: {
            city: city || null,
            region: region || null,
            country: country || null,
        },
    };
};
