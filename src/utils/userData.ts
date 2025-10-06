interface userRegisterData {
    email: string;
    password: string;
    firstName: string;  // Fixed casing
    lastName: string;
    username: string;
    phone?: string;     // Made optional
    favSports?: string[] | null;
    favTeamIds?: string[] | null;
    homeLat?: number | null;
    homeLng?: number | null;
}

export type { userRegisterData };