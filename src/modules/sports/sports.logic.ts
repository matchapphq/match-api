import { SportsRepository } from "../../repository/sports.repository";
import { apiSports } from "../../lib/api-sports";
import type { ApiFixtureResponse } from "../../lib/api-sports";

export class SportsLogic {
    constructor(private readonly sportsRepo: SportsRepository) {}

    // ============================================
    // SPORTS (DB-backed, football is auto-created)
    // ============================================

    async getSports(page: number, limit: number, isActive?: boolean) {
        // Ensure football sport exists
        await this.sportsRepo.getOrCreateFootballSport();

        return await this.sportsRepo.findAllSports({
            page,
            limit,
            isActive
        });
    }

    async getSportById(sportId: string) {
        const sport = await this.sportsRepo.findSportById(sportId);
        if (!sport) throw new Error("SPORT_NOT_FOUND");
        return sport;
    }

    // ============================================
    // COUNTRIES (pass-through to API-Sports)
    // ============================================

    async getCountries(search?: string) {
        const params: Record<string, string> = {};
        if (search) params.search = search;

        const result = await apiSports.getCountries(params);
        return result.response;
    }

    // ============================================
    // LEAGUES — fetch from API-Sports, sync to DB
    // ============================================

    async getLeaguesBySport(sportId: string, page: number, limit: number, isActive?: boolean, country?: string) {
        const sport = await this.sportsRepo.findSportById(sportId);
        if (!sport) throw new Error("SPORT_NOT_FOUND");

        return await this.sportsRepo.findLeaguesBySportId(sportId, {
            page,
            limit,
            isActive,
            country
        });
    }

    async getLeagueById(leagueId: string) {
        const league = await this.sportsRepo.findLeagueById(leagueId);
        if (!league) throw new Error("LEAGUE_NOT_FOUND");
        return league;
    }

    /**
     * Fetch leagues from API-Sports, sync to DB, return API response.
     * Params: country, season, search, type, current
     */
    async fetchLeagues(params: {
        country?: string;
        season?: string;
        search?: string;
        type?: string;
        current?: string;
    }) {
        const apiResult = await apiSports.getLeagues(params);
        const sportId = await this.sportsRepo.getOrCreateFootballSport();

        // Sync each league to DB in background (don't block response)
        for (const item of apiResult.response) {
            try {
                await this.sportsRepo.upsertLeagueFromApi(sportId, item);
            } catch (err) {
                console.error(`[SYNC] Failed to upsert league ${item.league.id}:`, err);
            }
        }

        return apiResult.response;
    }

    // ============================================
    // TEAMS — fetch from API-Sports, sync to DB
    // ============================================

    async getTeamsByLeague(leagueId: string, page: number, limit: number, isActive?: boolean) {
        const league = await this.sportsRepo.findLeagueById(leagueId);
        if (!league) throw new Error("LEAGUE_NOT_FOUND");

        return await this.sportsRepo.findTeamsByLeagueId(leagueId, {
            page,
            limit,
            isActive
        });
    }

    async getTeamById(teamId: string) {
        const team = await this.sportsRepo.findTeamById(teamId);
        if (!team) throw new Error("TEAM_NOT_FOUND");
        return team;
    }

    /**
     * Fetch teams from API-Sports, sync to DB, return API response.
     * Requires league + season for API-Sports.
     */
    async fetchTeams(params: {
        league?: string;
        season?: string;
        search?: string;
        country?: string;
    }) {
        const apiResult = await apiSports.getTeams(params);
        const sportId = await this.sportsRepo.getOrCreateFootballSport();

        // Sync each team to DB
        for (const item of apiResult.response) {
            try {
                // Ensure the league exists in our DB first
                let leagueInternalId: string | undefined;
                if (params.league) {
                    const existingLeague = await this.sportsRepo.findLeagueByApiId(parseInt(params.league));
                    if (existingLeague) {
                        leagueInternalId = existingLeague.id;
                    }
                }
                // If we have a league context, upsert the team
                if (leagueInternalId) {
                    await this.sportsRepo.upsertTeamFromApi(leagueInternalId, item);
                }
            } catch (err) {
                console.error(`[SYNC] Failed to upsert team ${item.team.id}:`, err);
            }
        }

        return apiResult.response;
    }

    // ============================================
    // FIXTURES — fetch from API-Sports, sync to DB
    // ============================================

    /**
     * Fetch fixtures from API-Sports, sync to DB, return API response.
     * Params: league, date, team, season, live, from, to, next, last
     */
    async fetchFixtures(params: {
        league?: string;
        date?: string;
        team?: string;
        season?: string;
        live?: string;
        from?: string;
        to?: string;
        next?: string;
        last?: string;
        status?: string;
    }) {
        const apiResult = await apiSports.getFixtures(params);

        // Sync each fixture to DB
        for (const fixture of apiResult.response) {
            try {
                await this.syncFixtureToDb(fixture);
            } catch (err) {
                console.error(`[SYNC] Failed to upsert fixture ${fixture.fixture.id}:`, err);
            }
        }

        return apiResult.response;
    }

    /**
     * Sync a single API-Sports fixture into the DB.
     * Ensures league and both teams exist before creating the match.
     */
    private async syncFixtureToDb(fixture: ApiFixtureResponse): Promise<string | null> {
        const sportId = await this.sportsRepo.getOrCreateFootballSport();

        // Upsert the league
        const leagueInternalId = await this.sportsRepo.upsertLeagueFromApi(sportId, {
            league: {
                id: fixture.league.id,
                name: fixture.league.name,
                type: "League",
                logo: fixture.league.logo,
            },
            country: {
                name: fixture.league.country,
                code: null,
                flag: fixture.league.flag,
            },
            seasons: [],
        });

        // Upsert home team
        const homeTeamId = await this.sportsRepo.upsertTeamFromApi(leagueInternalId, {
            team: {
                id: fixture.teams.home.id,
                name: fixture.teams.home.name,
                code: null,
                country: fixture.league.country,
                founded: null,
                national: false,
                logo: fixture.teams.home.logo,
            },
            venue: null,
        });

        // Upsert away team
        const awayTeamId = await this.sportsRepo.upsertTeamFromApi(leagueInternalId, {
            team: {
                id: fixture.teams.away.id,
                name: fixture.teams.away.name,
                code: null,
                country: fixture.league.country,
                founded: null,
                national: false,
                logo: fixture.teams.away.logo,
            },
            venue: null,
        });

        // Upsert the match
        return await this.sportsRepo.upsertMatchFromApi(
            fixture,
            leagueInternalId,
            homeTeamId,
            awayTeamId,
        );
    }

    // Keep legacy method for backward compat
    async getFixtures(query: any) {
        // If we have API-Sports params, use the real API
        try {
            const params: Record<string, string> = {};
            if (query.league_id) {
                // Try to find the league's api_id
                const league = await this.sportsRepo.findLeagueById(query.league_id);
                if (league?.api_id) {
                    params.league = String(league.api_id);
                }
            }
            if (query.date) params.date = query.date;
            if (query.sport_id) {
                // For now only football, so we can just fetch all
            }

            if (Object.keys(params).length > 0) {
                return await this.fetchFixtures(params);
            }
        } catch (err) {
            console.error("[FIXTURES] API-Sports fetch failed, falling back to DB:", err);
        }

        return { message: "No fixture params provided" };
    }
}
