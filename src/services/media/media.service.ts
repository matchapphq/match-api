import { Hono } from "hono";
import MediaController from "../../controllers/media/media.controller";

class MediaService {
    private readonly router = new Hono();
    private readonly controller = new MediaController();
    constructor() { };
    
    public getRouter() {
        return this.router;
    }
    
    public initializeRoutes() {
        this.router.post("/upload", ...this.controller.uploadMedia);
        this.router.get("/:mediaId", ...this.controller.getMedia);
    }
}

export default MediaService;
