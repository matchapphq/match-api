interface userRegisterData {
    email: string;
    username?: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: 'user' | 'venue_owner' | 'admin';
    phone?: string;
}

export type { userRegisterData };