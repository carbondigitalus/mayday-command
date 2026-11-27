// NPM Modules
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

/** How long a signed download link stays usable: 5 minutes. Long enough to load the file, short enough that a leaked
 * link soon stops working. */
const signedURLLifetimeSeconds = 5 * 60;

/** Reads and writes the private bucket that holds every asset. Speaks the S3 API, so it works with Railway's bucket,
 * AWS, Cloudflare R2, Backblaze or MinIO for local development, set by the `STORAGE_*` variables. It knows nothing
 * about who may see a file: callers check that before asking for a link. */
@Injectable()
export default class StorageService {
    private readonly bucket = process.env.STORAGE_BUCKET;

    /** One client for the bucket. Path-style addressing (`<endpoint>/<bucket>/<key>`) is what MinIO needs, and every
     * other S3-compatible store accepts it. */
    private readonly client = new S3Client({
        credentials: {
            accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
            secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY
        },
        endpoint: process.env.STORAGE_ENDPOINT,
        forcePathStyle: true,
        region: process.env.STORAGE_REGION
    });

    /** Removes the stored file at `key`. Removing a key that doesn't exist is not an error. */
    async delete(key: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }

    /** A link that downloads the file at `key` for the next {@link signedURLLifetimeSeconds} seconds. With
     * `fileName`, the browser saves it under that name. */
    async getSignedDownloadURL(key: string, fileName?: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ...(fileName && {
                ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
            })
        });

        return getSignedUrl(this.client, command, { expiresIn: signedURLLifetimeSeconds });
    }

    /** Stores `body` at `key` with `contentType`, replacing anything already there. */
    async upload(key: string, body: Buffer, contentType: string): Promise<void> {
        await this.client.send(
            new PutObjectCommand({ Body: body, Bucket: this.bucket, ContentType: contentType, Key: key })
        );
    }
}
