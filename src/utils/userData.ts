interface userRegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: 'user' | 'venue_owner' | 'admin';
    phone?: string;
}

export type { userRegisterData };