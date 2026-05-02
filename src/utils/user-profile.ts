import type {
    AuthProvider,
    ClientUserProfile,
    UserProfileSource,
} from "../types/user-profile.types";

function toStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
}

function getAuthProvider(user: UserProfileSource): AuthProvider {
    if (user.google_id) return "google";
    if (user.apple_id) return "apple";
    return "email";
}

export function mapToClientUserProfile(
    user: UserProfileSource,
    avatar: string | undefined,
): ClientUserProfile {
    const authProvider = getAuthProvider(user);
    const sports = toStringArray(user.fav_sports);
    const ambiances = toStringArray(user.ambiances);
    const venueTypes = toStringArray(user.venue_types);
    const hasPaymentMethod = Boolean(user.stripe_customer_id);

    const needsCompletion = authProvider !== "email" && user.role === "user";
    const hasCompletedStandardOnboarding =
        !needsCompletion ||
        (Boolean(user.phone?.trim()) &&
            sports.length > 0 &&
            ambiances.length > 0 &&
            venueTypes.length > 0 &&
            Boolean(user.budget));

    const hasCompletedOnboarding =
        user.role === "venue_owner" ? hasPaymentMethod : hasCompletedStandardOnboarding;
    const onboardingStep =
        user.role === "venue_owner"
            ? user.onboarding_step ?? (hasPaymentMethod ? "done" : null)
            : hasCompletedOnboarding
                ? "done"
                : null;

    return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        bio: user.bio,
        phone: user.phone,
        avatar: avatar ?? null,
        auth_provider: authProvider,
        preferences: {
            sports,
            ambiance: ambiances,
            foodTypes: venueTypes,
            budget: user.budget || "",
        },
        created_at: user.created_at,
        has_payment_method: hasPaymentMethod,
        has_completed_onboarding: hasCompletedOnboarding,
        onboarding_step: onboardingStep,
        buts: user.buts ?? 0,
        tier: user.tier || "Rookie",
    };
}
