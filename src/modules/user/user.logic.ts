import UserRepository from "../../repository/user.repository";
import { FavoritesRepository } from "../../repository/favorites.repository";
import { password as BunPassword } from "bun";
import { mailQueue } from "../../queue/notification.queue";

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
        
        const userData = (await this.userRepository.getUserById(userId))!;
        return {
            id: userData.id,
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone: userData.phone,
            bio: userData.bio,
            avatar: userData.avatar_url,
            role: userData.role,
            created_at: userData.created_at,
            has_completed_onboarding: true,
        };
    }

    /**
     * Update the current user's profile.
     */
    async updateUser(userId: string, data: { first_name?: string; last_name?: string; email?: string; phone?: string; avatar?: string; bio?: string }) {
        const updatedUser = await this.userRepository.updateUser(userId, data);
        if (!updatedUser) {
            throw new Error("USER_NOT_FOUND");
        }
        return {
            id: updatedUser.id,
            email: updatedUser.email,
            first_name: updatedUser.first_name,
            last_name: updatedUser.last_name,
            phone: updatedUser.phone,
            bio: updatedUser.bio,
            avatar: updatedUser.avatar_url,
            role: updatedUser.role,
            created_at: updatedUser.created_at,
        };
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