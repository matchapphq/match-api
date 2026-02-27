import axios from "axios";
import { isIP } from "node:net";

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
const SESSION_LOCATION_CACHE_MS = 10 * 60 * 1000;

const sessionLocationCache = new Map<
    string,
    {
        expiresAt: number;
        location: SessionLocation | null;
    }
>();
const pendingLocationLookups = new Map<string, Promise<SessionLocation | null>>();

const sanitize = (value: string | null | undefined): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const isSessionGeoIpEnabled = (): boolean => process.env.SESSION_GEOIP_ENABLED !== "false";

const getSessionGeoIpProviders = (ip: string): string[] => {
    const configuredProvider = sanitize(process.env.SESSION_GEOIP_PROVIDER_URL);
    if (configuredProvider) {
        return [configuredProvider.replace("{ip}", encodeURIComponent(ip))];
    }

    return [
        `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
        `https://ipwho.is/${encodeURIComponent(ip)}`,
        `https://ipinfo.io/${encodeURIComponent(ip)}/json`,
    ];
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

const isPrivateIpv4 = (ip: string): boolean => {
    const parts = ip.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
        return false;
    }

    const [first, second] = parts as [number, number, number, number];

    return (
        first === 10 ||
        first === 127 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168)
    );
};

const isPrivateIpv6 = (ip: string): boolean => {
    const normalized = ip.toLowerCase();
    return (
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("fe80:")
    );
};

const isPublicIp = (ip: string | null): ip is string => {
    if (!ip) return false;

    const version = isIP(ip);
    if (version === 4) return !isPrivateIpv4(ip);
    if (version === 6) return !isPrivateIpv6(ip);
    return false;
};

const normalizeLocation = (payload: {
    city?: unknown;
    region?: unknown;
    country?: unknown;
    country_name?: unknown;
}): SessionLocation | null => {
    const city = sanitize(typeof payload.city === "string" ? payload.city : null);
    const region = sanitize(typeof payload.region === "string" ? payload.region : null);
    const country = sanitize(
        typeof payload.country_name === "string"
            ? payload.country_name
            : typeof payload.country === "string"
              ? payload.country
              : null,
    );

    if (!city && !region && !country) {
        return null;
    }

    return { city, region, country };
};

const getCachedSessionLocation = (ip: string): SessionLocation | null | undefined => {
    const cached = sessionLocationCache.get(ip);
    if (!cached) return undefined;

    if (cached.expiresAt <= Date.now()) {
        sessionLocationCache.delete(ip);
        return undefined;
    }

    return cached.location;
};

const setCachedSessionLocation = (ip: string, location: SessionLocation | null): SessionLocation | null => {
    sessionLocationCache.set(ip, {
        expiresAt: Date.now() + SESSION_LOCATION_CACHE_MS,
        location,
    });
    return location;
};

const fetchSessionLocationForIp = async (ip: string): Promise<SessionLocation | null> => {
    if (!isSessionGeoIpEnabled()) {
        return null;
    }

    const providers = getSessionGeoIpProviders(ip);

    for (const provider of providers) {
        try {
            const response = await axios.get(provider, {
                timeout: 1500,
                headers: {
                    Accept: "application/json",
                },
            });

            const payload = response.data as {
                city?: unknown;
                region?: unknown;
                country?: unknown;
                country_name?: unknown;
                success?: unknown;
                bogon?: unknown;
            };

            if (payload.success === false || payload.bogon === true) {
                continue;
            }

            const location = normalizeLocation(payload);
            if (location) {
                return location;
            }
        } catch (error) {
            const providerLabel = (() => {
                try {
                    return new URL(provider).hostname;
                } catch {
                    return "configured-provider";
                }
            })();
            console.warn("[SESSION_GEOIP] Provider lookup failed:", providerLabel, error);
        }
    }

    return null;
};

const resolveLocationFromIp = async (ip: string | null): Promise<SessionLocation | null> => {
    if (!isPublicIp(ip)) {
        return null;
    }

    const cached = getCachedSessionLocation(ip);
    if (cached !== undefined) {
        return cached;
    }

    const pending = pendingLocationLookups.get(ip);
    if (pending) {
        return pending;
    }

    const lookupPromise = fetchSessionLocationForIp(ip)
        .then((location) => setCachedSessionLocation(ip, location))
        .finally(() => {
            pendingLocationLookups.delete(ip);
        });

    pendingLocationLookups.set(ip, lookupPromise);
    return lookupPromise;
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

export const mergeSessionDevicePreservingLocation = (
    previousRawDevice: string,
    nextRawDevice: string,
): string => {
    const previous = decodeSessionDevice(previousRawDevice);
    const next = decodeSessionDevice(nextRawDevice);

    const merged: SessionDeviceInfo = {
        userAgent: sanitize(next.userAgent) || sanitize(previous.userAgent) || "Unknown",
        ip: next.ip || previous.ip || null,
        location: {
            city: next.location.city || previous.location.city || null,
            region: next.location.region || previous.location.region || null,
            country: next.location.country || previous.location.country || null,
        },
    };

    return encodeSessionDevice(merged);
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

    const headerCity = firstHeaderValue(headers, ["x-vercel-ip-city", "x-geo-city", "x-appengine-city", "cf-ipcity"]);
    const headerRegion = firstHeaderValue(headers, [
        "x-vercel-ip-country-region",
        "x-geo-region",
        "x-appengine-region",
        "cf-region",
    ]);
    const headerCountry = firstHeaderValue(headers, ["x-vercel-ip-country", "cf-ipcountry", "x-geo-country"]);
    const headerLocation = normalizeLocation({
        city: headerCity,
        region: headerRegion,
        country: headerCountry,
    });
    const fallbackLocation = headerLocation ? null : await resolveLocationFromIp(ip);
    const location = headerLocation || fallbackLocation || { city: null, region: null, country: null };

    return {
        userAgent,
        ip,
        location,
    };
};
