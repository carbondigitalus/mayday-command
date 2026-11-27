// NPM Modules
import { Test, TestingModule } from '@nestjs/testing';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import InvitationController from 'src/invitation/invitation.controller';
import InvitationService from 'src/invitation/invitation.service';
import InvitationCreateDTO from 'src/invitation/dto/create.dto';
import InvitationTokenDTO from 'src/invitation/dto/token.dto';
import Account from 'src/database/account.entity';
import requiresRoleKey from 'src/utils/constants/role';
import RolesGuard from 'src/utils/guards/RolesGuard.guard';

describe('InvitationController', () => {
    let controller: InvitationController;
    let invitationService: jest.Mocked<Partial<InvitationService>>;

    const buildAccount = (accountID: string) => ({ id: accountID }) as Account;

    beforeEach(async () => {
        invitationService = {
            create: jest.fn(),
            preview: jest.fn(),
            accept: jest.fn(),
            decline: jest.fn(),
            readOrganizationAll: jest.fn(),
            readAccountAll: jest.fn(),
            acceptInviteByID: jest.fn(),
            declineInviteByID: jest.fn(),
            revoke: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [InvitationController],
            providers: [{ provide: InvitationService, useValue: invitationService }]
        })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get(InvitationController);
        jest.clearAllMocks();
    });

    describe('invitationCreateOrganizationScoped', () => {
        it('creates an organization-scoped invitation', () => {
            const data = {
                invitedEmail: 'a@b.com',
                role: AccountRole.OrganizationMember
            } as InvitationCreateDTO;
            (invitationService.create as jest.Mock).mockReturnValue({ invitation: { id: 'invite-1' } });

            const result = controller.invitationCreateOrganizationScoped('org-1', data, buildAccount('acc-1'));

            expect(invitationService.create).toHaveBeenCalledWith('acc-1', data, 'org-1');
            expect(result).toEqual({ invitation: { id: 'invite-1' } });
        });
    });

    describe('invitationCreatePlatform', () => {
        it('creates a platform invitation with no organization', () => {
            const data = {
                invitedEmail: 'a@b.com',
                role: AccountRole.PlatformAgent
            } as InvitationCreateDTO;
            (invitationService.create as jest.Mock).mockReturnValue({ invitation: { id: 'invite-1' } });

            const result = controller.invitationCreatePlatform(data, buildAccount('acc-1'));

            expect(invitationService.create).toHaveBeenCalledWith('acc-1', data);
            expect(result).toEqual({ invitation: { id: 'invite-1' } });
        });
    });

    describe('invitationPreview', () => {
        it('returns the invitation preview for the token', () => {
            (invitationService.preview as jest.Mock).mockReturnValue({
                inviterFirstName: 'Jane'
            });

            const result = controller.invitationPreview({ invitationToken: 'signed-token' });

            expect(invitationService.preview).toHaveBeenCalledWith('signed-token');
            expect(result).toEqual({ inviterFirstName: 'Jane' });
        });
    });

    describe('invitationAccept', () => {
        it('accepts the invitation for the authenticated account', () => {
            const data = { invitationToken: 'signed-token' } as InvitationTokenDTO;
            (invitationService.accept as jest.Mock).mockReturnValue({
                status: 'accepted'
            });

            const result = controller.invitationAccept(data, buildAccount('acc-1'));

            expect(invitationService.accept).toHaveBeenCalledWith('signed-token', 'acc-1');
            expect(result).toEqual({ status: 'accepted' });
        });
    });

    describe('invitationDecline', () => {
        it('declines the invitation for the token', () => {
            const data = { invitationToken: 'signed-token' } as InvitationTokenDTO;
            (invitationService.decline as jest.Mock).mockReturnValue({
                status: 'declined'
            });

            const result = controller.invitationDecline(data);

            expect(invitationService.decline).toHaveBeenCalledWith('signed-token');
            expect(result).toEqual({ status: 'declined' });
        });
    });

    describe('invitationReadOrganizationAll', () => {
        it('returns the pending invitation list for the organization', () => {
            const invitationList = [{ id: 'invite-1' }];
            (invitationService.readOrganizationAll as jest.Mock).mockReturnValue(invitationList);

            const result = controller.invitationReadOrganizationAll('org-1');

            expect(invitationService.readOrganizationAll).toHaveBeenCalledWith('org-1');
            expect(result).toEqual(invitationList);
        });
    });

    describe('invitationReadAccountAll', () => {
        it("returns the signed-in account's own pending invitations", () => {
            const invitationList = [{ id: 'invite-1' }];
            const account = buildAccount('acc-1');
            (invitationService.readAccountAll as jest.Mock).mockReturnValue(invitationList);

            const result = controller.invitationReadAccountAll(account);

            expect(invitationService.readAccountAll).toHaveBeenCalledWith(account);
            expect(result).toEqual(invitationList);
        });
    });

    describe('invitationAcceptByID', () => {
        it('accepts the invitation by id for the authenticated account', () => {
            (invitationService.acceptInviteByID as jest.Mock).mockReturnValue({
                status: 'accepted'
            });

            const result = controller.invitationAcceptByID('invite-1', buildAccount('acc-1'));

            expect(invitationService.acceptInviteByID).toHaveBeenCalledWith('invite-1', 'acc-1');
            expect(result).toEqual({ status: 'accepted' });
        });
    });

    describe('invitationDeclineByID', () => {
        it('declines the invitation by id for the authenticated account', () => {
            (invitationService.declineInviteByID as jest.Mock).mockReturnValue({
                status: 'declined'
            });

            const result = controller.invitationDeclineByID('invite-1', buildAccount('acc-1'));

            expect(invitationService.declineInviteByID).toHaveBeenCalledWith('invite-1', 'acc-1');
            expect(result).toEqual({ status: 'declined' });
        });
    });

    describe('invitationRevokeOne', () => {
        it('revokes the invitation for the authenticated account', () => {
            (invitationService.revoke as jest.Mock).mockReturnValue({
                status: 'revoked'
            });

            const result = controller.invitationRevokeOne('invite-1', buildAccount('acc-1'));

            expect(invitationService.revoke).toHaveBeenCalledWith('invite-1', 'acc-1');
            expect(result).toEqual({ status: 'revoked' });
        });
    });

    it.each([
        ['invitationCreateOrganizationScoped', InvitationController.prototype.invitationCreateOrganizationScoped],
        ['invitationReadOrganizationAll', InvitationController.prototype.invitationReadOrganizationAll]
    ])("%s is open to the organization's admins and to platform staff", (_name, handler) => {
        expect(Reflect.getMetadata(requiresRoleKey, handler)).toEqual({
            role: [AccountRole.OrganizationAdmin, AccountRole.PlatformAdmin, AccountRole.PlatformAgent],
            resourceParam: 'organizationID'
        });
    });
});
