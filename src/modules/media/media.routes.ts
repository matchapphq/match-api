import { Hono } from "hono";
import MediaController from "./media.controller";
import { MediaLogic } from "./media.logic";
import { StorageService } from "../../services/storage.service";
import UserRepository from "../../repository/user.repository";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";

class MediaService {
    private readonly router = new Hono<HonoEnv>();
    private readonly controller: MediaController;
    
    public get getRouter() {
        return this.router;
    }

    constructor() {
        const storageService = new StorageService();
        const userRepo = new UserRepository();
        const mediaLogic = new MediaLogic(storageService, userRepo);
        this.controller = new MediaController(mediaLogic);
        this.initializeRoutes();
    }
    
    public initializeRoutes() {
        // All media operations require authentication
        this.router.use("/*", authMiddleware);

        // Generic upload
        this.router.post("/upload", ...this.controller.uploadMedia);
        
        // Profile picture upload
        this.router.post("/avatar", ...this.controller.uploadAvatar);
        
        // Get media info
        this.router.get("/:mediaId", ...this.controller.getMedia);
    }
}

export default MediaService;
