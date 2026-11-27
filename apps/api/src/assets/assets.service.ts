// Core Modules
import { randomUUID } from 'node:crypto';

// NPM Modules
import {
    BadRequestException,
    Injectable,
    NotFoundException,
    PayloadTooLargeException,
    UnsupportedMediaTypeException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { Repository } from 'typeorm';

// Shared Modules
import { platformRoles } from '@mayday-command/utils/constants/roles.constants';

// Custom Modules
import StorageService from './storage.service';
import Account from 'src/database/account.entity';
import Asset from 'src/database/asset.entity';
import Organization from 'src/database/organization.entity';
import LoggerService from 'src/logger/logger.service';
import detectContentType from 'src/utils/helpers/detectContentType';
import AssetUploadRules from 'src/utils/interfaces/AssetUploadRules.interface';

/** One megabyte, in bytes. */
const megabyteBytes = 1024 * 1024;

/** Stores uploaded files as Assets: checks them against a kind's rules, prepares them, puts the bytes in the private
 * bucket and records the Asset row. */
@Injectable()
export default class AssetsService {
    /** Organization logos: PNG, JPEG or WebP up to 2 MB, stored as a PNG scaled to fit inside 800 by 800 with its
     * shape kept: nothing is cropped, and a smaller logo is enlarged to fill the box. Re-encoding also drops any
     * metadata the original carried, such as a photo's location. */
    static readonly logoRules: AssetUploadRules = {
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxBytes: 2 * megabyteBytes,
        transform: async (bytes) => ({
            bytes: await sharp(bytes).resize({ fit: 'inside', height: 800, width: 800 }).png().toBuffer(),
            contentType: 'image/png'
        })
    };

    /** The account, asset and organization repositories, plus the logger and the storage service. */
    constructor(
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(Asset)
        private assetRepository: Repository<Asset>,
        @InjectRepository(Organization)
        private organizationRepository: Repository<Organization>,
        private logger: LoggerService,
        private storageService: StorageService
    ) {}

    /** Removes an asset: its stored bytes, then its row. Callers unlink it from whatever used it first. */
    async delete(asset: Asset): Promise<void> {
        await this.storageService.delete(asset.storageKey);
        await this.assetRepository.delete(asset.id);

        this.logger.debug(`Asset ${asset.id} deleted`, 'AssetsService-delete');
    }

    /** A short-lived signed link to the asset's file, for `account`, if it may see it. Platform admins and agents may
     * see every asset. Anyone else may see an organization's logo only if they belong to that organization. An asset
     * the account may not see gets the same 404 as one that doesn't exist, so asset IDs can't be used to learn what
     * exists.
     * @throws NotFoundException when the asset doesn't exist or `account` may not see it. */
    async getDownloadURL(assetID: string, account: Account): Promise<string> {
        const logContext = 'AssetsService-getDownloadURL';

        const asset = await this.assetRepository.findOne({ where: { id: assetID } });

        if (!asset || !(await this.canView(asset, account))) {
            this.logger.warn(`Asset ${assetID} not shown to ${account.id}: missing or not allowed`, logContext);
            throw new NotFoundException('File not found.');
        }

        return this.storageService.getSignedDownloadURL(asset.storageKey, asset.fileName);
    }

    /** Checks `file` against `rules`, prepares it, stores the bytes under a new API-generated key and records the
     * Asset, uploaded by `uploadedBy`. If recording the Asset fails, the stored bytes are deleted again so nothing is
     * left behind.
     * @throws BadRequestException when no file was sent.
     * @throws PayloadTooLargeException when the file is over the size limit.
     * @throws UnsupportedMediaTypeException when its contents aren't an allowed type. */
    async upload(file: Express.Multer.File | undefined, rules: AssetUploadRules, uploadedBy: Account): Promise<Asset> {
        const logContext = 'AssetsService-upload';

        if (!file?.buffer?.length) {
            throw new BadRequestException('A file is required.');
        }

        if (file.size > rules.maxBytes) {
            this.logger.warn(`Upload refused for ${uploadedBy.id}: ${file.size} bytes is over the limit`, logContext);
            throw new PayloadTooLargeException(`Files can be up to ${rules.maxBytes / megabyteBytes} MB.`);
        }

        const detectedType = detectContentType(file.buffer);

        if (!detectedType || !rules.allowedContentTypes.includes(detectedType)) {
            this.logger.warn(`Upload refused for ${uploadedBy.id}: type ${detectedType ?? 'unknown'}`, logContext);
            throw new UnsupportedMediaTypeException('That type of file is not allowed here.');
        }

        const { bytes, contentType } = rules.transform
            ? await rules.transform(file.buffer)
            : { bytes: file.buffer, contentType: detectedType };

        const storageKey = `assets/${randomUUID()}`;

        await this.storageService.upload(storageKey, bytes, contentType);

        try {
            const asset = await this.assetRepository.save(
                this.assetRepository.create({
                    contentType,
                    fileName: file.originalname,
                    size: bytes.length,
                    storageKey,
                    uploadedBy
                })
            );

            this.logger.debug(`Asset ${asset.id} stored for ${uploadedBy.id}`, logContext);

            return asset;
        } catch (error) {
            await this.storageService.delete(storageKey);

            throw error;
        }
    }

    /** Whether `account` may see `asset`: every asset for a platform role; otherwise only an organization's logo, and
     * only for a member of that organization. An asset nothing uses is visible to platform roles alone. */
    private async canView(asset: Asset, account: Account): Promise<boolean> {
        if (account.role && platformRoles.includes(account.role)) {
            return true;
        }

        const organization = await this.organizationRepository.findOne({
            select: { id: true },
            where: { logo: { id: asset.id } }
        });

        if (!organization) {
            return false;
        }

        return this.accountRepository.exists({
            where: { id: account.id, organizationList: { id: organization.id } }
        });
    }
}
