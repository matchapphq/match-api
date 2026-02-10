import { Hono } from "hono";
import MediaController from "./media.controller";
import { MediaLogic } from "./media.logic";

class MediaService {
    private readonly router = new Hono();
    private readonly controller: MediaController;
    
    public get getRouter() {
        return this.router;
    }

    constructor() {
        const mediaLogic = new MediaLogic();
        this.controller = new MediaController(mediaLogic);
        this.initializeRoutes();
    }
    
    public initializeRoutes() {
        this.router.post("/upload", ...this.controller.uploadMedia);
        this.router.get("/:mediaId", ...this.controller.getMedia);
    }
}

export default MediaService;