export class MediaLogic {
    async uploadMedia() {
        return { msg: "Media uploaded successfully" };
    }

    async getMedia(mediaId: string) {
        return { msg: `Media retrieved successfully for ID: ${mediaId}` };
    }
}
