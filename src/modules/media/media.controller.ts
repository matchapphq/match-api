import { createFactory } from "hono/factory";
import { MediaLogic } from "./media.logic";

class MediaController {
    private readonly factory = createFactory();
    
    constructor(private readonly mediaLogic: MediaLogic) {}

    public readonly uploadMedia = this.factory.createHandlers(async (ctx) => {
        const result = await this.mediaLogic.uploadMedia();
        return ctx.json(result);
    })
    
    public readonly getMedia = this.factory.createHandlers(async (ctx) => {
        const mediaId = ctx.req.param("mediaId");
        const result = await this.mediaLogic.getMedia(mediaId);
        return ctx.json(result);
    })
    
}

export default MediaController;