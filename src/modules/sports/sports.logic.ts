import { SportsRepository } from "../../repository/sports.repository";

export class SportsLogic {
    constructor(private readonly sportsRepo: SportsRepository) {}

    async getSports(page: number, limit: number, isActive?: boolean) {
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

    async getFixtures(query: any) {
        // Placeholder for fixture logic
        return { message: "Fixtures not implemented yet" };
    }
}
