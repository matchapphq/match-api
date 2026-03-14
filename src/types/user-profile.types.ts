export type AuthProvider = "google" | "apple" | "email";

export type UserRole = "user" | "venue_owner" | "admin";

export interface UserProfileSource {
    id: string;
    email: string;
    role: UserRole;
    first_name: string | null;
    last_name: string | null;
    bio: string | null;
    phone: string | null;
    avatar_url: string | null;
    google_id: string | null;
    apple_id: string | null;
    stripe_customer_id: string | null;
    created_at: Date | string;
    fav_sports: unknown;
    ambiances: unknown;
    venue_types: unknown;
    budget: string | null;
}

export interface UserProfilePreferences {
    sports: string[];
    ambiance: string[];
    foodTypes: string[];
    budget: string;
}

export interface ClientUserProfile {
    id: string;
    email: string;
    role: UserRole;
    first_name: string | null;
    last_name: string | null;
    bio: string | null;
    phone: string | null;
    avatar: string | null;
    auth_provider: AuthProvider;
    preferences: UserProfilePreferences;
    created_at: Date | string;
    has_payment_method: boolean;
    has_completed_onboarding: boolean;
}

