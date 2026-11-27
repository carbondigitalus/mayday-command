// NPM Modules
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Custom Modules
import StorageService from 'src/assets/storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

const mockedGetSignedURL = getSignedUrl as jest.Mock;

describe('StorageService', () => {
    const originalEnv = { ...process.env };
    let service: StorageService;
    let send: jest.SpyInstance;

    beforeEach(() => {
        process.env.STORAGE_ACCESS_KEY_ID = 'access-key';
        process.env.STORAGE_BUCKET = 'mayday-assets';
        process.env.STORAGE_ENDPOINT = 'http://localhost:9000';
        process.env.STORAGE_REGION = 'us-east-1';
        process.env.STORAGE_SECRET_ACCESS_KEY = 'secret-key';

        send = jest.spyOn(S3Client.prototype, 'send').mockImplementation(() => Promise.resolve({}));
        mockedGetSignedURL.mockResolvedValue('https://signed.example/assets/abc');
        service = new StorageService();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        mockedGetSignedURL.mockReset();
        process.env = { ...originalEnv };
    });

    describe('client', () => {
        it('uses path-style addressing, which MinIO needs, against the configured endpoint and region', async () => {
            const client = (service as unknown as { client: S3Client }).client;

            expect(client.config.forcePathStyle).toBe(true);
            await expect(client.config.region()).resolves.toBe('us-east-1');
        });
    });

    describe('upload', () => {
        it('puts the file in the configured bucket with its content type', async () => {
            const body = Buffer.from('file');

            await service.upload('assets/abc', body, 'image/png');

            const [command] = send.mock.calls[0] as [PutObjectCommand];
            expect(command).toBeInstanceOf(PutObjectCommand);
            expect(command.input).toEqual({
                Body: body,
                Bucket: 'mayday-assets',
                ContentType: 'image/png',
                Key: 'assets/abc'
            });
        });

        it('passes a storage failure through', async () => {
            send.mockRejectedValue(new Error('bucket unreachable'));

            await expect(service.upload('assets/abc', Buffer.from('file'), 'image/png')).rejects.toThrow(
                'bucket unreachable'
            );
        });
    });

    describe('delete', () => {
        it('deletes the key from the configured bucket', async () => {
            await service.delete('assets/abc');

            const [command] = send.mock.calls[0] as [DeleteObjectCommand];
            expect(command).toBeInstanceOf(DeleteObjectCommand);
            expect(command.input).toEqual({ Bucket: 'mayday-assets', Key: 'assets/abc' });
        });
    });

    describe('getSignedDownloadURL', () => {
        it('signs a download link that lasts five minutes', async () => {
            const result = await service.getSignedDownloadURL('assets/abc');

            const [, command, options] = mockedGetSignedURL.mock.calls[0] as [S3Client, GetObjectCommand, object];
            expect(command).toBeInstanceOf(GetObjectCommand);
            expect(command.input).toEqual({ Bucket: 'mayday-assets', Key: 'assets/abc' });
            expect(options).toEqual({ expiresIn: 300 });
            expect(result).toBe('https://signed.example/assets/abc');
        });

        it('names the download after the original file, safely encoded', async () => {
            await service.getSignedDownloadURL('assets/abc', 'Q3 report "final".pdf');

            const [, command] = mockedGetSignedURL.mock.calls[0] as [S3Client, GetObjectCommand];
            expect(command.input.ResponseContentDisposition).toBe(
                `inline; filename*=UTF-8''${encodeURIComponent('Q3 report "final".pdf')}`
            );
        });
    });
});
