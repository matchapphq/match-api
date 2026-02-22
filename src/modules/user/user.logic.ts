import UserRepository from "../../repository/user.repository";
import { FavoritesRepository } from "../../repository/favorites.repository";
import { StorageService } from "../../services/storage.service";
import { password as BunPassword } from "bun";
import { mailQueue } from "../../queue/notification.queue";

/**
 * Service handling Pure Business Logic for Users.
 * No Hono/HTTP dependencies here.
 */
export class UserLogic {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly favoritesRepository: FavoritesRepository,
        private readonly storageService: StorageService
    ) {}

    /**
     * Get the current user's full profile.
     */
    async getUserProfile(userId: string) {
        const users = await this.userRepository.getMe({ id: userId });
        
        if (!users || users.length === 0) {
            throw new Error("USER_NOT_FOUND");
        }

        const userData = users[0]!;
        const toArray = (value: unknown): string[] =>
            Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
        const authProvider = userData.google_id
            ? "google"
            : userData.apple_id
              ? "apple"
              : "email";
        const sports = toArray(userData.fav_sports);
        const ambiances = toArray(userData.ambiances);
        const venueTypes = toArray(userData.venue_types);
        const needsCompletion = authProvider !== "email" && userData.role === "user";
        const hasCompletedOnboarding =
            !needsCompletion ||
            (Boolean(userData.phone?.trim()) &&
                sports.length > 0 &&
                ambiances.length > 0 &&
                venueTypes.length > 0 &&
                Boolean(userData.budget));

        return {
            id: userData.id,
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            bio: userData.bio,
            phone: userData.phone,
            avatar: this.storageService.getFullUrl(userData.avatar_url),
            role: userData.role,
            auth_provider: authProvider,
            preferences: {
                sports,
                ambiance: ambiances,
                foodTypes: venueTypes,
                budget: userData.budget || "",
            },
            created_at: userData.created_at,
            has_completed_onboarding: hasCompletedOnboarding,
        };
    }

    /**
     * Update the current user's profile.
     */
    async updateUser(
        userId: string,
        data: {
            first_name?: string;
            last_name?: string;
            email?: string;
            phone?: string;
            bio?: string;
            avatar?: string;
            fav_sports?: string[];
            fav_team_ids?: string[];
            ambiances?: string[];
            venue_types?: string[];
            budget?: string;
            home_lat?: number;
            home_lng?: number;
        }
    ) {
        const {
            fav_sports,
            fav_team_ids,
            ambiances,
            venue_types,
            budget,
            home_lat,
            home_lng,
            ...profileUpdates
        } = data;

        if (Object.keys(profileUpdates).length > 0) {
            const updatedUser = await this.userRepository.updateUser(userId, profileUpdates);
            if (!updatedUser) {
                throw new Error("USER_NOT_FOUND");
            }
        } else {
            const existingUser = await this.userRepository.getUserById(userId);
            if (!existingUser) {
                throw new Error("USER_NOT_FOUND");
            }
        }

        const hasPreferencesPatch =
            fav_sports !== undefined ||
            fav_team_ids !== undefined ||
            ambiances !== undefined ||
            venue_types !== undefined ||
            budget !== undefined ||
            home_lat !== undefined ||
            home_lng !== undefined;

        if (hasPreferencesPatch) {
            await this.userRepository.saveUserPreferences(userId, {
                fav_sports,
                fav_team_ids,
                ambiances,
                venue_types,
                budget,
                home_lat,
                home_lng,
            });
        }

        return this.getUserProfile(userId);
    }
    
    /**
     * Delete user account after verifying password.
     */
    public async deleteUser(userId: string, reason: string, details: string | undefined, password: string) {
        const user = await this.userRepository.getUserById(userId);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }
        
        const isPasswordValid = await BunPassword.verify(password, user.password_hash);
        if (!isPasswordValid) {
            throw new Error("INVALID_PASSWORD");
        }
        
        // Send confirmation email before deleting the user record
        await mailQueue.add("account-deletion", {
            to: user.email,
            subject: "Confirmation de suppression de compte - Match",
            data: {
                userName: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
            }
        });

        await this.userRepository.deleteUser(userId, reason, details);
        return true;
    }
    
    
    async updatePassword(userId: string, data: { current_password: string; new_password: string }) {
        const user = await this.userRepository.getUserById(userId);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }

        const isPasswordValid = await BunPassword.verify(data.current_password, user.password_hash);
        if (!isPasswordValid) {
            throw new Error("INVALID_CURRENT_PASSWORD");
        }

        const newPasswordHash = await BunPassword.hash(data.new_password, { algorithm: "bcrypt", cost: 10 });
        await this.userRepository.updateUserPassword(userId, newPasswordHash);
        
        return true;
    }

    /**
     * Update the user's push notification token.
     */
    async updatePushToken(userId: string, pushToken: string) {
        const updatedUser = await this.userRepository.updateUser(userId, { push_token: pushToken });
        if (!updatedUser) {
            throw new Error("USER_NOT_FOUND");
        }
        return true;
    }

    /**
     * Get user favorites with business-level pagination.
     */
    async getFavorites(userId: string, pagination: { page: number; limit: number }) {
        return await this.favoritesRepository.getFavorites(userId, pagination);
    }
}
