// NPM Modules
import {
    BadRequestException,
    NotFoundException,
    PayloadTooLargeException,
    UnsupportedMediaTypeException
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import sharp from 'sharp';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import AssetsService from 'src/assets/assets.service';
import StorageService from 'src/assets/storage.service';
import Account from 'src/database/account.entity';
import Asset from 'src/database/asset.entity';
import Organization from 'src/database/organization.entity';
import LoggerService from 'src/logger/logger.service';

describe('AssetsService', () => {
    let service: AssetsService;
    let accountRepository: { exists: jest.Mock };
    let assetRepository: { create: jest.Mock; delete: jest.Mock; findOne: jest.Mock; save: jest.Mock };
    let organizationRepository: { findOne: jest.Mock };
    let storageService: { delete: jest.Mock; getSignedDownloadURL: jest.Mock; upload: jest.Mock };

    const uploadedBy = { id: 'acc-1' } as Account;

    const multerFile = (buffer: Buffer, originalname = 'logo.png'): Express.Multer.File =>
        ({ buffer, originalname, size: buffer.length }) as Express.Multer.File;

    const image = (format: 'jpeg' | 'png', width = 40, height = 20) =>
        sharp({ create: { background: 'blue', channels: 3, height, width } })
            .toFormat(format)
            .toBuffer();

    beforeEach(async () => {
        assetRepository = {
            create: jest.fn((data: Partial<Asset>) => data),
            delete: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn((data: Partial<Asset>) => Promise.resolve({ id: 'asset-1', ...data }))
        };
        accountRepository = { exists: jest.fn().mockResolvedValue(false) };
        organizationRepository = { findOne: jest.fn().mockResolvedValue(null) };
        storageService = {
            delete: jest.fn(),
            getSignedDownloadURL: jest.fn().mockResolvedValue('https://signed.example/assets/abc'),
            upload: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AssetsService,
                { provide: getRepositoryToken(Account), useValue: accountRepository },
                { provide: getRepositoryToken(Asset), useValue: assetRepository },
                { provide: getRepositoryToken(Organization), useValue: organizationRepository },
                { provide: LoggerService, useValue: { debug: jest.fn(), warn: jest.fn() } },
                { provide: StorageService, useValue: storageService }
            ]
        }).compile();

        service = module.get(AssetsService);
    });

    describe('upload with the logo rules', () => {
        it('stores the logo as a PNG under a new key, and records the asset', async () => {
            const result = await service.upload(multerFile(await image('jpeg')), AssetsService.logoRules, uploadedBy);

            const [storageKey, bytes, contentType] = storageService.upload.mock.calls[0] as [string, Buffer, string];
            expect(storageKey).toMatch(/^assets\/[0-9a-f-]{36}$/);
            expect(contentType).toBe('image/png');
            await expect(sharp(bytes).metadata()).resolves.toMatchObject({ format: 'png' });
            expect(assetRepository.create).toHaveBeenCalledWith({
                contentType: 'image/png',
                fileName: 'logo.png',
                size: bytes.length,
                storageKey,
                uploadedBy
            });
            expect(result).toMatchObject({ id: 'asset-1', storageKey });
        });

        it('fits a wide logo inside 800 by 800 without cropping, keeping its shape', async () => {
            await service.upload(multerFile(await image('png', 1600, 400)), AssetsService.logoRules, uploadedBy);

            const [, bytes] = storageService.upload.mock.calls[0] as [string, Buffer];
            await expect(sharp(bytes).metadata()).resolves.toMatchObject({ height: 200, width: 800 });
        });

        it('fits a tall logo inside 800 by 800 the same way', async () => {
            await service.upload(multerFile(await image('png', 500, 1000)), AssetsService.logoRules, uploadedBy);

            const [, bytes] = storageService.upload.mock.calls[0] as [string, Buffer];
            await expect(sharp(bytes).metadata()).resolves.toMatchObject({ height: 800, width: 400 });
        });

        it('enlarges a logo smaller than 800 by 800 to fill the box, keeping its shape', async () => {
            await service.upload(multerFile(await image('png', 120, 60)), AssetsService.logoRules, uploadedBy);

            const [, bytes] = storageService.upload.mock.calls[0] as [string, Buffer];
            await expect(sharp(bytes).metadata()).resolves.toMatchObject({ height: 400, width: 800 });
        });

        it('refuses a missing file (400)', async () => {
            await expect(service.upload(undefined, AssetsService.logoRules, uploadedBy)).rejects.toThrow(
                BadRequestException
            );
        });

        it('refuses a logo over 2 MB (413) before reading it', async () => {
            const tooBig = { ...multerFile(await image('png')), size: 2 * 1024 * 1024 + 1 };

            await expect(service.upload(tooBig, AssetsService.logoRules, uploadedBy)).rejects.toThrow(
                new PayloadTooLargeException('Files can be up to 2 MB.')
            );
            expect(storageService.upload).not.toHaveBeenCalled();
        });

        it('refuses a file whose contents are not an allowed image, whatever its name says (415)', async () => {
            const disguised = multerFile(Buffer.from('%PDF-1.7 not an image'), 'logo.png');

            await expect(service.upload(disguised, AssetsService.logoRules, uploadedBy)).rejects.toThrow(
                UnsupportedMediaTypeException
            );
            expect(storageService.upload).not.toHaveBeenCalled();
        });

        it('deletes the stored bytes again if recording the asset fails', async () => {
            assetRepository.save.mockRejectedValue(new Error('database down'));

            await expect(
                service.upload(multerFile(await image('png')), AssetsService.logoRules, uploadedBy)
            ).rejects.toThrow('database down');

            const [storageKey] = storageService.upload.mock.calls[0] as [string];
            expect(storageService.delete).toHaveBeenCalledWith(storageKey);
        });
    });

    describe('upload without a transform', () => {
        it('stores the original bytes with their detected type', async () => {
            const pdf = Buffer.from('%PDF-1.7 a document');

            await service.upload(
                multerFile(pdf, 'report.pdf'),
                { allowedContentTypes: ['application/pdf'], maxBytes: 5 * 1024 * 1024 },
                uploadedBy
            );

            expect(storageService.upload).toHaveBeenCalledWith(expect.any(String), pdf, 'application/pdf');
        });
    });

    describe('delete', () => {
        it('removes the stored bytes, then the row', async () => {
            await service.delete({ id: 'asset-1', storageKey: 'assets/abc' } as Asset);

            expect(storageService.delete).toHaveBeenCalledWith('assets/abc');
            expect(assetRepository.delete).toHaveBeenCalledWith('asset-1');
            expect(storageService.delete.mock.invocationCallOrder[0]).toBeLessThan(
                assetRepository.delete.mock.invocationCallOrder[0]
            );
        });
    });

    describe('getDownloadURL', () => {
        const asset = { id: 'asset-1', fileName: 'logo.png', storageKey: 'assets/abc' } as Asset;
        const member = { id: 'acc-1', role: AccountRole.OrganizationMember } as Account;

        beforeEach(() => {
            assetRepository.findOne.mockResolvedValue(asset);
        });

        it.each([AccountRole.PlatformAdmin, AccountRole.PlatformAgent])(
            'gives a %s a signed link to any asset',
            async (role) => {
                const url = await service.getDownloadURL('asset-1', { id: 'staff-1', role } as Account);

                expect(storageService.getSignedDownloadURL).toHaveBeenCalledWith('assets/abc', 'logo.png');
                expect(organizationRepository.findOne).not.toHaveBeenCalled();
                expect(url).toBe('https://signed.example/assets/abc');
            }
        );

        it('gives a member of the organization a signed link to its logo', async () => {
            organizationRepository.findOne.mockResolvedValue({ id: 'org-1' });
            accountRepository.exists.mockResolvedValue(true);

            await expect(service.getDownloadURL('asset-1', member)).resolves.toBe('https://signed.example/assets/abc');
            expect(organizationRepository.findOne).toHaveBeenCalledWith({
                select: { id: true },
                where: { logo: { id: 'asset-1' } }
            });
            expect(accountRepository.exists).toHaveBeenCalledWith({
                where: { id: 'acc-1', organizationList: { id: 'org-1' } }
            });
        });

        it("refuses another organization's logo with the same 404 as a missing file", async () => {
            organizationRepository.findOne.mockResolvedValue({ id: 'org-2' });

            await expect(service.getDownloadURL('asset-1', member)).rejects.toThrow(
                new NotFoundException('File not found.')
            );
            expect(storageService.getSignedDownloadURL).not.toHaveBeenCalled();
        });

        it('refuses an asset nothing uses to anyone but platform staff', async () => {
            await expect(service.getDownloadURL('asset-1', member)).rejects.toThrow(NotFoundException);
        });

        it('refuses an account with no role', async () => {
            organizationRepository.findOne.mockResolvedValue({ id: 'org-1' });

            await expect(service.getDownloadURL('asset-1', { id: 'acc-9', role: null } as Account)).rejects.toThrow(
                NotFoundException
            );
        });

        it('returns 404 for an asset that does not exist', async () => {
            assetRepository.findOne.mockResolvedValue(null);

            await expect(service.getDownloadURL('asset-9', member)).rejects.toThrow(NotFoundException);
        });
    });
});
