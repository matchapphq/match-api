import UserRepository from "../../repository/user.repository";
import { FavoritesRepository } from "../../repository/favorites.repository";

/**
 * Service handling Pure Business Logic for Users.
 * No Hono/HTTP dependencies here.
 */
export class UserLogic {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly favoritesRepository: FavoritesRepository
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
        return {
            id: userData.id,
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone: userData.phone,
            role: userData.role,
            has_completed_onboarding: true // Logic can be more complex here
        };
    }

    /**
     * Get user favorites with business-level pagination.
     */
    async getFavorites(userId: string, pagination: { page: number; limit: number }) {
        return await this.favoritesRepository.getFavorites(userId, pagination);
    }
}
