// NPM Modules
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import OrganizationService from 'src/organization/organization.service';
import OrganizationUpdateDTO from 'src/organization/dto/update.dto';
import AccountService from 'src/account/account.service';
import AssetsService from 'src/assets/assets.service';
import Account from 'src/database/account.entity';
import Organization from 'src/database/organization.entity';
import LoggerService from 'src/logger/logger.service';

describe('OrganizationService', () => {
    let service: OrganizationService;
    let organizationRepository: {
        create: jest.Mock;
        save: jest.Mock;
        find: jest.Mock;
        findOne: jest.Mock;
        preload: jest.Mock;
        manager: { transaction: jest.Mock };
    };
    let accountRepository: { find: jest.Mock };
    /** The transaction's entity manager, which removeMember uses for its locked check-and-remove. */
    let manager: { count: jest.Mock; createQueryBuilder: jest.Mock; findOne: jest.Mock };
    let relation: { of: jest.Mock; remove: jest.Mock };
    let accountService: { assignRole: jest.Mock };
    let assetsService: { delete: jest.Mock; upload: jest.Mock };
    let logger: { debug: jest.Mock; warn: jest.Mock };

    beforeEach(async () => {
        jest.clearAllMocks();

        organizationRepository = {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            preload: jest.fn(),
            manager: {
                transaction: jest.fn((work: (transactionManager: typeof manager) => Promise<unknown>) => work(manager))
            }
        };
        accountRepository = { find: jest.fn() };
        relation = { of: jest.fn(), remove: jest.fn() };
        relation.of.mockReturnValue(relation);
        manager = {
            count: jest.fn().mockResolvedValue(2),
            createQueryBuilder: jest.fn().mockReturnValue({ relation: jest.fn().mockReturnValue(relation) }),
            findOne: jest.fn()
        };
        accountService = { assignRole: jest.fn() };
        assetsService = { delete: jest.fn(), upload: jest.fn() };
        logger = { debug: jest.fn(), warn: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrganizationService,
                {
                    provide: getRepositoryToken(Organization),
                    useValue: organizationRepository
                },
                { provide: getRepositoryToken(Account), useValue: accountRepository },
                { provide: AccountService, useValue: accountService },
                { provide: AssetsService, useValue: assetsService },
                { provide: LoggerService, useValue: logger }
            ]
        }).compile();

        service = module.get(OrganizationService);
    });

    describe('create', () => {
        beforeEach(() => {
            organizationRepository.create.mockReturnValue({ name: 'Acme' });
            organizationRepository.save.mockResolvedValue({ id: 'org-1', name: 'Acme' });
        });

        it('adds a creator with no role to the organization as organization:admin', async () => {
            await service.create({ name: 'Acme' }, { id: 'acc-1', role: null } as Account);

            expect(organizationRepository.create).toHaveBeenCalledWith({ name: 'Acme' });
            expect(accountService.assignRole).toHaveBeenCalledWith('acc-1', AccountRole.OrganizationAdmin, 'org-1');
        });

        it('adds a customer creator to the organization, leaving their role to assignRole', async () => {
            await service.create({ name: 'Acme' }, { id: 'acc-1', role: AccountRole.OrganizationMember } as Account);

            expect(accountService.assignRole).toHaveBeenCalledWith('acc-1', AccountRole.OrganizationAdmin, 'org-1');
        });

        it.each([AccountRole.PlatformAdmin, AccountRole.PlatformAgent])(
            'does not add a %s creator to the organization',
            async (role) => {
                const result = await service.create({ name: 'Acme' }, { id: 'acc-1', role } as Account);

                expect(accountService.assignRole).not.toHaveBeenCalled();
                expect(result).toEqual({ id: 'org-1', name: 'Acme' });
            }
        );
    });

    describe('readMembers', () => {
        it("returns the organization's members with only the fields a member list needs", async () => {
            const memberList = [{ id: 'acc-1', role: AccountRole.OrganizationAdmin }];
            accountRepository.find.mockResolvedValue(memberList);

            const result = await service.readMembers('org-1');

            expect(accountRepository.find).toHaveBeenCalledWith({
                where: { organizationList: { id: 'org-1' } },
                select: { id: true, email: true, firstName: true, lastName: true, role: true },
                order: { lastName: 'ASC', firstName: 'ASC' }
            });
            expect(result).toBe(memberList);
        });
    });

    describe('removeMember', () => {
        const organization = { id: 'org-1' };

        it('locks the organization, then removes the membership', async () => {
            manager.findOne
                .mockResolvedValueOnce(organization)
                .mockResolvedValueOnce({ id: 'acc-2', role: AccountRole.OrganizationMember });

            const result = await service.removeMember('org-1', 'acc-2');

            expect(manager.findOne).toHaveBeenNthCalledWith(1, Organization, {
                where: { id: 'org-1' },
                lock: { mode: 'pessimistic_write' }
            });
            expect(relation.of).toHaveBeenCalledWith('acc-2');
            expect(relation.remove).toHaveBeenCalledWith('org-1');
            expect(result).toEqual({ status: 'success' });
        });

        it('lets an organization admin go when another admin remains, including removing themselves', async () => {
            manager.findOne
                .mockResolvedValueOnce(organization)
                .mockResolvedValueOnce({ id: 'acc-1', role: AccountRole.OrganizationAdmin });

            await service.removeMember('org-1', 'acc-1');

            expect(manager.count).toHaveBeenCalledWith(Account, {
                where: { role: AccountRole.OrganizationAdmin, organizationList: { id: 'org-1' } }
            });
            expect(relation.remove).toHaveBeenCalledWith('org-1');
        });

        it("refuses to remove the organization's last admin", async () => {
            manager.findOne
                .mockResolvedValueOnce(organization)
                .mockResolvedValueOnce({ id: 'acc-1', role: AccountRole.OrganizationAdmin });
            manager.count.mockResolvedValue(1);

            await expect(service.removeMember('org-1', 'acc-1')).rejects.toThrow(
                new ForbiddenException('An organization must keep at least one admin.')
            );
            expect(relation.remove).not.toHaveBeenCalled();
        });

        it('returns 404 for an account that is not a member', async () => {
            manager.findOne.mockResolvedValueOnce(organization).mockResolvedValueOnce(null);

            await expect(service.removeMember('org-1', 'acc-9')).rejects.toThrow(
                new NotFoundException('That account is not a member of this organization.')
            );
        });

        it('returns 404 for an organization that does not exist', async () => {
            manager.findOne.mockResolvedValueOnce(null);

            await expect(service.removeMember('org-9', 'acc-1')).rejects.toThrow(
                new NotFoundException('Organization not found.')
            );
        });
    });

    describe('readAll', () => {
        it.each([AccountRole.PlatformAdmin, AccountRole.PlatformAgent])(
            'returns every active organization to a %s',
            async (role) => {
                const list = [{ id: 'org-1' }];
                organizationRepository.find.mockResolvedValue(list);

                const result = await service.readAll({ id: 'acc-1', role } as Account);

                expect(organizationRepository.find).toHaveBeenCalledWith({
                    relations: { logo: true },
                    where: { isActive: true }
                });
                expect(result).toEqual(list);
            }
        );

        it.each([AccountRole.OrganizationAdmin, AccountRole.OrganizationMember, null])(
            'returns only the organizations a %s account belongs to',
            async (role) => {
                organizationRepository.find.mockResolvedValue([]);

                await service.readAll({ id: 'acc-1', role } as Account);

                expect(organizationRepository.find).toHaveBeenCalledWith({
                    relations: { logo: true },
                    where: { isActive: true, accountList: { id: 'acc-1' } }
                });
            }
        );
    });

    describe('readOne', () => {
        it('throws NotFoundException when the organization does not exist', async () => {
            organizationRepository.findOne.mockResolvedValue(null);

            await expect(service.readOne('org-1')).rejects.toThrow(NotFoundException);
        });

        it('returns the organization when found', async () => {
            const organization = { id: 'org-1' };
            organizationRepository.findOne.mockResolvedValue(organization);

            const result = await service.readOne('org-1');

            expect(result).toEqual(organization);
        });
    });

    describe('update', () => {
        it('throws NotFoundException when the organization does not exist', async () => {
            organizationRepository.preload.mockResolvedValue(undefined);

            await expect(service.update('org-1', { name: 'New Name' } as any)).rejects.toThrow(NotFoundException);
        });

        it('updates the organization when found', async () => {
            organizationRepository.preload.mockResolvedValue({
                id: 'org-1',
                name: 'New Name'
            });
            organizationRepository.save.mockResolvedValue({
                id: 'org-1',
                name: 'New Name'
            });

            const result = await service.update('org-1', {
                name: 'New Name'
            } as any);

            expect(result).toEqual({ id: 'org-1', name: 'New Name' });
        });

        it('always updates the organization in the route, even if the body names another', async () => {
            organizationRepository.preload.mockResolvedValue({ id: 'org-1', name: 'New Name' });

            await service.update('org-1', { id: 'org-2', name: 'New Name' } as OrganizationUpdateDTO);

            expect(organizationRepository.preload).toHaveBeenCalledWith({ id: 'org-1', name: 'New Name' });
            expect(organizationRepository.findOne).not.toHaveBeenCalled();
        });
    });

    describe('uploadLogo', () => {
        const file = { buffer: Buffer.from('img') } as Express.Multer.File;
        const uploader = { id: 'acc-1' } as Account;
        const newLogo = { id: 'asset-new' };

        beforeEach(() => {
            assetsService.upload.mockResolvedValue(newLogo);
            organizationRepository.preload.mockResolvedValue({ id: 'org-1', logo: newLogo });
            organizationRepository.save.mockResolvedValue({ id: 'org-1', logo: newLogo });
        });

        it('throws NotFoundException, without uploading, when the organization does not exist', async () => {
            organizationRepository.findOne.mockResolvedValue(null);

            await expect(service.uploadLogo('org-1', file, uploader)).rejects.toThrow(NotFoundException);
            expect(assetsService.upload).not.toHaveBeenCalled();
        });

        it('uploads under the logo rules and links the new asset as the logo', async () => {
            organizationRepository.findOne.mockResolvedValue({ id: 'org-1', logo: null });

            const result = await service.uploadLogo('org-1', file, uploader);

            expect(organizationRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'org-1' },
                relations: { logo: true }
            });
            expect(assetsService.upload).toHaveBeenCalledWith(file, AssetsService.logoRules, uploader);
            expect(organizationRepository.preload).toHaveBeenCalledWith({ id: 'org-1', logo: newLogo });
            expect(assetsService.delete).not.toHaveBeenCalled();
            expect(result).toEqual({ id: 'org-1', logo: newLogo });
        });

        it('deletes the replaced logo, after the new one is linked', async () => {
            const oldLogo = { id: 'asset-old' };
            organizationRepository.findOne.mockResolvedValue({ id: 'org-1', logo: oldLogo });

            await service.uploadLogo('org-1', file, uploader);

            expect(assetsService.delete).toHaveBeenCalledWith(oldLogo);
            expect(organizationRepository.save.mock.invocationCallOrder[0]).toBeLessThan(
                assetsService.delete.mock.invocationCallOrder[0]
            );
        });

        it('keeps the new logo, logging a warning, when the replaced one cannot be deleted', async () => {
            organizationRepository.findOne.mockResolvedValue({ id: 'org-1', logo: { id: 'asset-old' } });
            assetsService.delete.mockRejectedValue(new Error('storage down'));

            await expect(service.uploadLogo('org-1', file, uploader)).resolves.toEqual({ id: 'org-1', logo: newLogo });
            expect(logger.warn).toHaveBeenCalled();
        });

        it('does not save when the upload fails', async () => {
            organizationRepository.findOne.mockResolvedValue({ id: 'org-1', logo: null });
            assetsService.upload.mockRejectedValue(new Error('storage down'));

            await expect(service.uploadLogo('org-1', file, uploader)).rejects.toThrow('storage down');
            expect(organizationRepository.save).not.toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('throws NotFoundException when the organization does not exist', async () => {
            organizationRepository.preload.mockResolvedValue(undefined);

            await expect(service.delete('org-1')).rejects.toThrow(NotFoundException);
        });

        it('soft-deletes the organization when found', async () => {
            organizationRepository.preload.mockResolvedValue({
                id: 'org-1',
                isActive: false
            });
            organizationRepository.save.mockResolvedValue({
                id: 'org-1',
                isActive: false
            });

            const result = await service.delete('org-1');

            expect(organizationRepository.preload).toHaveBeenCalledWith({
                id: 'org-1',
                isActive: false
            });
            expect(result).toEqual({ id: 'org-1', isActive: false });
        });
    });
});
