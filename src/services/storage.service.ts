import { S3Client } from "bun";

export class StorageService {
    private readonly s3: S3Client;
    private readonly bucket: string;
    private readonly publicUrl: string;

    constructor() {
        this.bucket = process.env.S3_BUCKET || "";
        
        // Using Bun's built-in S3 client (available in Bun v1.2+)
        this.s3 = new S3Client({
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            bucket: this.bucket,
            region: process.env.S3_REGION || "us-east-1",
            endpoint: process.env.S3_ENDPOINT, // Required for R2, Minio, etc.
        });

        // Determine the base URL for public access
        if (process.env.S3_PUBLIC_URL) {
            this.publicUrl = process.env.S3_PUBLIC_URL.endsWith('/') 
                ? process.env.S3_PUBLIC_URL.slice(0, -1) 
                : process.env.S3_PUBLIC_URL;
        } else if (process.env.S3_ENDPOINT) {
            this.publicUrl = `${process.env.S3_ENDPOINT}/${this.bucket}`;
        } else {
            this.publicUrl = `https://${this.bucket}.s3.${process.env.S3_REGION || "us-east-1"}.amazonaws.com`;
        }
    }

    /**
     * Get the full public URL for a given key
     * @param key The S3 key (path)
     * @returns Full URL
     */
    getFullUrl(key: string | null | undefined): string | undefined {
        if (!key) return undefined;
        if (key.startsWith('http://') || key.startsWith('https://')) return key;
        return `${this.publicUrl}/${key}`;
    }

    /**
     * Upload a file to S3
     * @param file The file to upload
     * @param subDir Optional sub-directory
     * @param customFileName Optional custom name for the file
     * @returns Object containing the key and full public URL
     */
    async upload(file: File, subDir: string = "", customFileName?: string): Promise<{ key: string; url: string }> {
        const extension = file.name.split(".").pop() || "bin";
        const fileName = customFileName ? `${customFileName}.${extension}` : `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
        
        const key = subDir ? `${subDir}/${fileName}` : fileName;
        const arrayBuffer = await file.arrayBuffer();
        try {
            const response = await this.s3.write(key, arrayBuffer, {
                type: file.type,
                acl: "public-read",
            });
        } catch (error) {
            console.error(`Error uploading file: ${error}`);
            throw error;
        }
        return {
            key,
            url: `${this.publicUrl}/${key}`
        };
    }

    /**
     * Delete a file from S3
     * @param keyOrUrl The key or full public URL of the file to delete
     */
    async delete(keyOrUrl: string): Promise<void> {
        let key = keyOrUrl;
        
        // If it's a full URL, extract the key
        if (keyOrUrl.startsWith(this.publicUrl)) {
            key = keyOrUrl.replace(`${this.publicUrl}/`, "");
        } else if (keyOrUrl.startsWith('http')) {
            // It's an external URL, don't try to delete from our S3
            return;
        }
        
        try {
            await this.s3.delete(key);
        } catch (error) {
            console.error(`Failed to delete file from S3: ${key}`, error);
        }
    }
}

export const storageService = new StorageService();
