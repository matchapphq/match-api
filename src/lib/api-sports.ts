/**
 * API-Sports Football v3 Client
 * 
 * Fetches real football data from API-Sports.
 * Base URL: https://v3.football.api-sports.io
 * Auth: x-apisports-key header
 * 
 * No caching layer yet — direct API calls only.
 */

const API_BASE = "https://v3.football.api-sports.io";

function getHeaders(): Record<string, string> {
    const key = process.env.API_SPORTS_KEY;
    if (!key) {
        throw new Error("API_SPORTS_KEY environment variable is not set");
    }
    return {
        "x-apisports-key": key,
    };
}

// ============================================
// TYPES — Raw API-Sports response shapes
// ============================================

export interface ApiSportsResponse<T> {
    get: string;
    parameters: Record<string, string>;
    errors: any[];
    results: number;
    paging: { current: number; total: number };
    response: T[];
}

export interface ApiCountry {
    name: string;
    code: string | null;
    flag: string | null;
}

export interface ApiLeagueResponse {
    league: {
        id: number;
        name: string;
        type: string;
        logo: string;
    };
    country: {
        name: string;
        code: string | null;
        flag: string | null;
    };
    seasons: Array<{
        year: number;
        start: string;
        end: string;
        current: boolean;
    }>;
}

export interface ApiTeamResponse {
    team: {
        id: number;
        name: string;
        code: string | null;
        country: string;
        founded: number | null;
        national: boolean;
        logo: string;
    };
    venue: {
        id: number | null;
        name: string | null;
        address: string | null;
        city: string | null;
        capacity: number | null;
        surface: string | null;
        image: string | null;
    } | null;
}

export interface ApiFixtureResponse {
    fixture: {
        id: number;
        referee: string | null;
        timezone: string;
        date: string;
        timestamp: number;
        periods: {
            first: number | null;
            second: number | null;
        };
        venue: {
            id: number | null;
            name: string | null;
            city: string | null;
        };
        status: {
            long: string;
            short: string;
            elapsed: number | null;
            extra: number | null;
        };
    };
    league: {
        id: number;
        name: string;
        country: string;
        logo: string;
        flag: string | null;
        season: number;
        round: string;
    };
    teams: {
        home: {
            id: number;
            name: string;
            logo: string;
            winner: boolean | null;
        };
        away: {
            id: number;
            name: string;
            logo: string;
            winner: boolean | null;
        };
    };
    goals: {
        home: number | null;
        away: number | null;
    };
    score: {
        halftime: { home: number | null; away: number | null };
        fulltime: { home: number | null; away: number | null };
        extratime: { home: number | null; away: number | null };
        penalty: { home: number | null; away: number | null };
    };
}

// ============================================
// STATUS MAPPING
// ============================================

/**
 * Maps API-Sports status codes to our internal match_status enum:
 * 'scheduled' | 'live' | 'finished' | 'canceled' | 'postponed'
 */
export function mapFixtureStatus(apiStatus: string): "scheduled" | "live" | "finished" | "canceled" | "postponed" {
    switch (apiStatus) {
        case "TBD":
        case "NS":
            return "scheduled";
        case "1H":
        case "HT":
        case "2H":
        case "ET":
        case "P":
        case "BT":
        case "LIVE":
            return "live";
        case "FT":
        case "AET":
        case "PEN":
            return "finished";
        case "CANC":
        case "ABD":
        case "AWD":
        case "WO":
            return "canceled";
        case "PST":
        case "SUSP":
        case "INT":
            return "postponed";
        default:
            return "scheduled";
    }
}

// ============================================
// API FETCH HELPERS
// ============================================

async function fetchFromApi<T>(endpoint: string, params?: Record<string, string>): Promise<ApiSportsResponse<T>> {
    const url = new URL(`${API_BASE}${endpoint}`);
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, value);
            }
        }
    }

    console.log(`[API-SPORTS] Fetching: ${url.toString()}`);

    const res = await fetch(url.toString(), { headers: getHeaders() });

    if (!res.ok) {
        const text = await res.text();
        console.error(`[API-SPORTS] Error ${res.status}: ${text}`);
        throw new Error(`API-Sports returned ${res.status}: ${text}`);
    }

    const data = await res.json() as ApiSportsResponse<T>;

    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        console.error("[API-SPORTS] API errors:", data.errors);
    }
    // API-Sports returns errors as object when there are issues
    if (data.errors && typeof data.errors === "object" && !Array.isArray(data.errors) && Object.keys(data.errors).length > 0) {
        console.error("[API-SPORTS] API errors:", data.errors);
        throw new Error(`API-Sports errors: ${JSON.stringify(data.errors)}`);
    }

    console.log(`[API-SPORTS] Got ${data.results} results for ${endpoint}`);
    return data;
}

// ============================================
// PUBLIC API METHODS
// ============================================

export const apiSports = {
    /**
     * Get countries
     */
    async getCountries(params?: { name?: string; code?: string; search?: string }) {
        return fetchFromApi<ApiCountry>("/countries", params as Record<string, string>);
    },

    /**
     * Get leagues with optional filters
     */
    async getLeagues(params?: {
        id?: string;
        name?: string;
        country?: string;
        code?: string;
        season?: string;
        team?: string;
        current?: string;
        search?: string;
        type?: string;
    }) {
        return fetchFromApi<ApiLeagueResponse>("/leagues", params as Record<string, string>);
    },

    /**
     * Get teams with optional filters
     */
    async getTeams(params?: {
        id?: string;
        name?: string;
        league?: string;
        season?: string;
        country?: string;
        search?: string;
    }) {
        return fetchFromApi<ApiTeamResponse>("/teams", params as Record<string, string>);
    },

    /**
     * Get fixtures (matches) with optional filters
     */
    async getFixtures(params?: {
        id?: string;
        live?: string;
        date?: string;
        league?: string;
        season?: string;
        team?: string;
        last?: string;
        next?: string;
        from?: string;
        to?: string;
        status?: string;
    }) {
        return fetchFromApi<ApiFixtureResponse>("/fixtures", params as Record<string, string>);
    },
};
