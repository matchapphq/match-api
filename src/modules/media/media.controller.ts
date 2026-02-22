import { createFactory } from "hono/factory";
import { MediaLogic } from "./media.logic";
import type { HonoEnv } from "../../types/hono.types";

class MediaController {
    private readonly factory = createFactory<HonoEnv>();
    
    constructor(private readonly mediaLogic: MediaLogic) {}

    /**
     * POST /media/upload
     * Generic upload handler
     */
    public readonly uploadMedia = this.factory.createHandlers(async (ctx) => {
        try {
            const body = await ctx.req.parseBody();
            const file = body["file"];
            const type = (body["type"] as string) || "general";

            if (!file || !(file instanceof File)) {
                return ctx.json({ error: "No file uploaded" }, 400);
            }

            const result = await this.mediaLogic.uploadMedia(file, type);
            return ctx.json(result);
        } catch (error: any) {
            console.error("Upload media error:", error);
            return ctx.json({ error: "Failed to upload media" }, 500);
        }
    })

    /**
     * POST /media/avatar
     * Specialized profile picture upload
     */
    public readonly uploadAvatar = this.factory.createHandlers(async (ctx) => {
        try {
            const user = ctx.get("user");
            if (!user || !user.id) {
                return ctx.json({ error: "Unauthorized" }, 401);
            }

            const body = await ctx.req.parseBody();
            const file = body["file"];

            if (!file || !(file instanceof File)) {
                return ctx.json({ error: "No file uploaded" }, 400);
            }

            const result = await this.mediaLogic.uploadProfilePicture(user.id, file);
            return ctx.json(result);
        } catch (error: any) {
            if (error.message === "INVALID_FILE_TYPE") {
                return ctx.json({ error: "Invalid file type. Only images are allowed." }, 400);
            }
            console.error("Upload avatar error:", error);
            return ctx.json({ error: "Failed to upload profile picture" }, 500);
        }
    })
    
    public readonly getMedia = this.factory.createHandlers(async (ctx) => {
        const mediaId = ctx.req.param("mediaId") as string;
        const result = await this.mediaLogic.getMedia(mediaId);
        return ctx.json(result);
    })
    
}

export default MediaController;
