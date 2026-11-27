// NPM Modules
import { Test, TestingModule } from '@nestjs/testing';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import OrganizationController from 'src/organization/organization.controller';
import OrganizationService from 'src/organization/organization.service';
import OrganizationCreateDTO from 'src/organization/dto/create.dto';
import OrganizationUpdateDTO from 'src/organization/dto/update.dto';
import Account from 'src/database/account.entity';
import requiresRoleKey from 'src/utils/constants/role';
import RolesGuard from 'src/utils/guards/RolesGuard.guard';

describe('OrganizationController', () => {
    let controller: OrganizationController;
    let organizationService: jest.Mocked<Partial<OrganizationService>>;

    const buildAccount = (accountID: string) => ({ id: accountID }) as Account;

    beforeEach(async () => {
        organizationService = {
            create: jest.fn(),
            readAll: jest.fn(),
            readOne: jest.fn(),
            update: jest.fn(),
            uploadLogo: jest.fn(),
            delete: jest.fn(),
            readMembers: jest.fn(),
            removeMember: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [OrganizationController],
            providers: [{ provide: OrganizationService, useValue: organizationService }]
        })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get(OrganizationController);
        jest.clearAllMocks();
    });

    describe('organizationCreateOne', () => {
        it('creates the organization for the authenticated account', () => {
            const data = { name: 'Acme' } as OrganizationCreateDTO;
            (organizationService.create as jest.Mock).mockReturnValue({
                id: 'org-1'
            });

            const result = controller.organizationCreateOne(data, buildAccount('acc-1'));

            expect(organizationService.create).toHaveBeenCalledWith(data, { id: 'acc-1' });
            expect(result).toEqual({ id: 'org-1' });
        });
    });

    describe('organizationReadAll', () => {
        it('returns the organizations the signed-in account may see', () => {
            const list = [{ id: 'org-1' }];
            const account = { id: 'acc-1' } as Account;
            (organizationService.readAll as jest.Mock).mockReturnValue(list);

            const result = controller.organizationReadAll(account);

            expect(organizationService.readAll).toHaveBeenCalledWith(account);
            expect(result).toEqual(list);
        });
    });

    it.each([
        ['organizationDeleteOne', OrganizationController.prototype.organizationDeleteOne],
        ['organizationUpdateOne', OrganizationController.prototype.organizationUpdateOne],
        ['organizationUploadLogo', OrganizationController.prototype.organizationUploadLogo]
    ])("%s is open to the organization's admins and to platform staff", (_name, handler) => {
        expect(Reflect.getMetadata(requiresRoleKey, handler)).toEqual({
            role: [AccountRole.OrganizationAdmin, AccountRole.PlatformAdmin, AccountRole.PlatformAgent],
            resourceParam: 'organizationID'
        });
    });

    describe('organizationReadOne', () => {
        it('requires membership in the organization, or a platform role', () => {
            const requirement = Reflect.getMetadata(
                requiresRoleKey,
                OrganizationController.prototype.organizationReadOne
            );

            expect(requirement).toEqual({ role: Object.values(AccountRole), resourceParam: 'organizationID' });
        });

        it('returns the organization by id', () => {
            const organization = { id: 'org-1' };
            (organizationService.readOne as jest.Mock).mockReturnValue(organization);

            const result = controller.organizationReadOne('org-1');

            expect(organizationService.readOne).toHaveBeenCalledWith('org-1');
            expect(result).toEqual(organization);
        });
    });

    describe('organizationUpdateOne', () => {
        it('updates the organization', () => {
            const data = { name: 'New Name' } as OrganizationUpdateDTO;
            const updated = { id: 'org-1', name: 'New Name' };
            (organizationService.update as jest.Mock).mockReturnValue(updated);

            const result = controller.organizationUpdateOne('org-1', data);

            expect(organizationService.update).toHaveBeenCalledWith('org-1', data);
            expect(result).toEqual(updated);
        });
    });

    describe('organizationUploadLogo', () => {
        it('passes the id and uploaded file to the service', () => {
            const file = { buffer: Buffer.from('img') } as Express.Multer.File;
            (organizationService.uploadLogo as jest.Mock).mockReturnValue({
                id: 'org-1',
                logo: 'organization-logo-org-1.png'
            });

            const result = controller.organizationUploadLogo('org-1', file);

            expect(organizationService.uploadLogo).toHaveBeenCalledWith('org-1', file);
            expect(result).toEqual({ id: 'org-1', logo: 'organization-logo-org-1.png' });
        });
    });

    describe('organizationDeleteOne', () => {
        it('deletes the organization', () => {
            const deleted = { id: 'org-1', isActive: false };
            (organizationService.delete as jest.Mock).mockReturnValue(deleted);

            const result = controller.organizationDeleteOne('org-1');

            expect(organizationService.delete).toHaveBeenCalledWith('org-1');
            expect(result).toEqual(deleted);
        });
    });

    it("organizationReadMembers and organizationRemoveMember are open to the organization's admins and to platform staff", () => {
        [
            OrganizationController.prototype.organizationReadMembers,
            OrganizationController.prototype.organizationRemoveMember
        ].forEach((handler) =>
            expect(Reflect.getMetadata(requiresRoleKey, handler)).toEqual({
                role: [AccountRole.OrganizationAdmin, AccountRole.PlatformAdmin, AccountRole.PlatformAgent],
                resourceParam: 'organizationID'
            })
        );
    });

    it('organizationReadMembers and organizationRemoveMember delegate to the service', () => {
        (organizationService.readMembers as jest.Mock).mockReturnValue(['member']);
        (organizationService.removeMember as jest.Mock).mockReturnValue({ status: 'success' });

        expect(controller.organizationReadMembers('org-1')).toEqual(['member']);
        expect(controller.organizationRemoveMember('org-1', 'acc-2')).toEqual({ status: 'success' });
        expect(organizationService.removeMember).toHaveBeenCalledWith('org-1', 'acc-2');
    });
});
