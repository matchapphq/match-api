import { StorageService } from "../../services/storage.service";
import UserRepository from "../../repository/user.repository";

export class MediaLogic {
    constructor(
        private readonly storageService: StorageService,
        private readonly userRepo: UserRepository,
    ) {}

    /**
     * Generic media upload
     */
    async uploadMedia(file: File, type: string = "general") {
        const { key, url } = await this.storageService.upload(file, type);
        return { 
            success: true,
            key,
            url,
            message: "Media uploaded successfully",
        };
    }

    /**
     * Upload profile picture and update user profile
     */
    async uploadProfilePicture(userId: string, file: File) {
        if (!file.type.startsWith("image/")) {
            throw new Error("INVALID_FILE_TYPE");
        }

        // Upload to storage using user ID as filename and specific path
        const { key, url } = await this.storageService.upload(file, "avatars", userId);

        // Get current user to delete old avatar if exists
        const user = await this.userRepo.getUserById(userId);
        if (user && user.avatar_url) {
            // Delete old file from S3 using its key (stored in DB) or full URL
            await this.storageService.delete(user.avatar_url).catch(err => {
                console.warn("Failed to delete old avatar:", err);
            });
        }

        // Update user record with the KEY (path) only
        await this.userRepo.updateUser(userId, { avatar: key });

        return {
            success: true,
            url, // Return full URL to the client for immediate display
            message: "Profile picture updated successfully",
        };
    }

    async getMedia(mediaId: string) {
        return { msg: `Media info for ID: ${mediaId}` };
    }
}
