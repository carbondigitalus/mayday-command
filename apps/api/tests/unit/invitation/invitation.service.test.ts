// NPM Modules
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Not } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';
import InvitationStatus from '@mayday-command/utils/enums/InvitationStatus.enum';

// Custom Modules
import InvitationService from 'src/invitation/invitation.service';
import AccountService from 'src/account/account.service';
import AuthService from 'src/auth/auth.service';
import Account from 'src/database/account.entity';
import Invitation from 'src/database/invitation.entity';
import Organization from 'src/database/organization.entity';
import LoggerService from 'src/logger/logger.service';

describe('InvitationService', () => {
    let service: InvitationService;
    let invitationRepository: {
        create: jest.Mock;
        save: jest.Mock;
        find: jest.Mock;
        findOne: jest.Mock;
        preload: jest.Mock;
        update: jest.Mock;
    };
    let accountRepository: { exists: jest.Mock; findOne: jest.Mock };
    let organizationRepository: { findOne: jest.Mock };
    let accountService: { assignRole: jest.Mock };
    let authService: {
        generateTokenInvitation: jest.Mock;
        decodeTokenInvitation: jest.Mock;
    };
    let emailQueue: { add: jest.Mock };
    let logger: { debug: jest.Mock; warn: jest.Mock };

    beforeEach(async () => {
        jest.clearAllMocks();

        invitationRepository = {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            preload: jest.fn(),
            update: jest.fn()
        };
        accountRepository = { exists: jest.fn().mockResolvedValue(false), findOne: jest.fn() };
        organizationRepository = { findOne: jest.fn() };
        accountService = { assignRole: jest.fn() };
        authService = {
            generateTokenInvitation: jest.fn(),
            decodeTokenInvitation: jest.fn()
        };
        emailQueue = { add: jest.fn() };
        logger = { debug: jest.fn(), warn: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InvitationService,
                {
                    provide: getRepositoryToken(Invitation),
                    useValue: invitationRepository
                },
                {
                    provide: getRepositoryToken(Account),
                    useValue: accountRepository
                },
                {
                    provide: getRepositoryToken(Organization),
                    useValue: organizationRepository
                },
                { provide: AccountService, useValue: accountService },
                { provide: AuthService, useValue: authService },
                { provide: getQueueToken('email'), useValue: emailQueue },
                { provide: LoggerService, useValue: logger }
            ]
        }).compile();

        service = module.get(InvitationService);
    });

    describe('create', () => {
        beforeEach(() => {
            invitationRepository.find.mockResolvedValue([]);
            invitationRepository.create.mockImplementation((data: object) => data);
            invitationRepository.save.mockResolvedValue({ id: 'invite-1', invitedEmail: 'a@b.com' });
            authService.generateTokenInvitation.mockResolvedValue({ invitationToken: 'signed-token' });
        });

        it('refuses to invite an existing member of the organization (409)', async () => {
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1' });
            organizationRepository.findOne.mockResolvedValue({ id: 'org-1' });
            accountRepository.exists.mockResolvedValue(true);

            await expect(
                service.create('acc-1', { invitedEmail: 'A@B.com', role: AccountRole.OrganizationMember }, 'org-1')
            ).rejects.toThrow(new ConflictException('That person is already a member of this organization.'));
            expect(accountRepository.exists).toHaveBeenCalledWith({
                where: { email: 'a@b.com', organizationList: { id: 'org-1' } }
            });
            expect(invitationRepository.save).not.toHaveBeenCalled();
        });

        it('refuses a platform invitation to an account that already has a role (409)', async () => {
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1' });
            accountRepository.exists.mockResolvedValue(true);

            await expect(
                service.create('acc-1', { invitedEmail: 'a@b.com', role: AccountRole.PlatformAgent })
            ).rejects.toThrow(ConflictException);
            expect(accountRepository.exists).toHaveBeenCalledWith({
                where: { email: 'a@b.com', role: Not(IsNull()) }
            });
        });

        it('revokes a still-pending invitation for the same email and organization before sending a new one', async () => {
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1' });
            organizationRepository.findOne.mockResolvedValue({ id: 'org-1' });
            invitationRepository.find.mockResolvedValue([{ id: 'old-invite' }]);

            await service.create('acc-1', { invitedEmail: 'a@b.com', role: AccountRole.OrganizationMember }, 'org-1');

            expect(invitationRepository.find).toHaveBeenCalledWith({
                where: { invitedEmail: 'a@b.com', organization: { id: 'org-1' }, status: InvitationStatus.Pending },
                select: { id: true }
            });
            expect(invitationRepository.update).toHaveBeenCalledWith(
                { id: In(['old-invite']) },
                { status: InvitationStatus.Revoked }
            );
            expect(invitationRepository.save).toHaveBeenCalled();
        });

        it('looks for a pending platform invitation with no organization', async () => {
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1' });

            await service.create('acc-1', { invitedEmail: 'a@b.com', role: AccountRole.PlatformAgent });

            expect(invitationRepository.find).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ organization: IsNull() }) })
            );
            expect(invitationRepository.update).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when the inviting account does not exist', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(
                service.create('acc-1', {
                    invitedEmail: 'a@b.com',
                    role: AccountRole.PlatformAgent
                })
            ).rejects.toThrow(NotFoundException);
        });

        it('refuses an organization invitation that offers a platform role (400)', async () => {
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1' });

            await expect(
                service.create('acc-1', { invitedEmail: 'a@b.com', role: AccountRole.PlatformAdmin }, 'org-1')
            ).rejects.toThrow(new BadRequestException('An organization invitation must offer an organization role.'));
            expect(invitationRepository.create).not.toHaveBeenCalled();
        });

        it('refuses a platform invitation that offers an organization role (400)', async () => {
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1' });

            await expect(
                service.create('acc-1', { invitedEmail: 'a@b.com', role: AccountRole.OrganizationMember })
            ).rejects.toThrow(new BadRequestException('A platform invitation must offer a platform role.'));
            expect(invitationRepository.create).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when organizationID is given but not found', async () => {
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1' });
            organizationRepository.findOne.mockResolvedValue(null);

            await expect(
                service.create('acc-1', { invitedEmail: 'a@b.com', role: AccountRole.OrganizationMember }, 'org-1')
            ).rejects.toThrow(NotFoundException);
        });

        it('creates an organization-scoped invitation when organizationID resolves', async () => {
            const organization = { id: 'org-1' } as Organization;
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1' });
            organizationRepository.findOne.mockResolvedValue(organization);
            invitationRepository.create.mockReturnValue({
                invitedEmail: 'a@b.com'
            });
            invitationRepository.save.mockResolvedValue({
                id: 'invite-1',
                invitedEmail: 'a@b.com'
            });
            authService.generateTokenInvitation.mockResolvedValue({
                invitationToken: 'signed-token'
            });

            await service.create('acc-1', { invitedEmail: 'a@b.com', role: AccountRole.OrganizationMember }, 'org-1');

            expect(invitationRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({ organization, role: AccountRole.OrganizationMember })
            );
        });

        it('creates the invitation and emails the token, without returning it', async () => {
            accountRepository.findOne.mockResolvedValue({
                id: 'acc-1',
                firstName: 'Jane',
                lastName: 'Doe'
            });
            invitationRepository.create.mockReturnValue({
                invitedEmail: 'a@b.com'
            });
            invitationRepository.save.mockResolvedValue({
                id: 'invite-1',
                invitedEmail: 'a@b.com'
            });
            authService.generateTokenInvitation.mockResolvedValue({
                invitationToken: 'signed-token'
            });

            const result = await service.create('acc-1', {
                invitedEmail: 'A@B.com',
                role: AccountRole.PlatformAgent
            });

            expect(invitationRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    invitedEmail: 'a@b.com',
                    role: AccountRole.PlatformAgent,
                    status: InvitationStatus.Pending
                })
            );
            const [{ expiresAt }] = invitationRepository.create.mock.calls[0] as [{ expiresAt: Date }];
            expect(authService.generateTokenInvitation).toHaveBeenCalledWith('invite-1', expiresAt);
            expect(emailQueue.add).toHaveBeenCalledWith('invitation-email', {
                email: 'a@b.com',
                inviterFirstName: 'Jane',
                inviterLastName: 'Doe',
                roleLabel: AccountRole.PlatformAgent,
                organizationName: undefined,
                invitationToken: 'signed-token',
                expiresInDays: 7
            });
            expect(result).toEqual({ invitation: { id: 'invite-1', invitedEmail: 'a@b.com' } });
            expect(JSON.stringify(result)).not.toContain('signed-token');
        });
    });

    describe('accept', () => {
        const decodedToken = { sub: 'invite-1', email: 'a@b.com' };

        it('throws NotFoundException when the invitation does not exist', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue(null);

            await expect(service.accept('token', 'acc-1')).rejects.toThrow(NotFoundException);
        });

        it('throws ForbiddenException when the invitation is not pending', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });

            await expect(service.accept('token', 'acc-1')).rejects.toThrow(ForbiddenException);
        });

        it('throws NotFoundException when the accepting account does not exist', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com'
            });
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.accept('token', 'acc-1')).rejects.toThrow(NotFoundException);
        });

        it('throws ForbiddenException when the account email does not match the invite', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com'
            });
            accountRepository.findOne.mockResolvedValue({
                id: 'acc-1',
                email: 'someone-else@b.com'
            });

            await expect(service.accept('token', 'acc-1')).rejects.toThrow(ForbiddenException);
        });

        it('joins the organization, offers the role, and marks the invitation Accepted', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com',
                role: AccountRole.OrganizationMember,
                organization: { id: 'org-1' },
                invitedBy: { id: 'inviter-1' }
            });
            accountRepository.findOne.mockResolvedValue({
                id: 'acc-1',
                email: 'a@b.com'
            });
            invitationRepository.preload.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });
            invitationRepository.save.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });

            const result = await service.accept('token', 'acc-1');

            expect(accountService.assignRole).toHaveBeenCalledWith('acc-1', AccountRole.OrganizationMember, 'org-1');
            expect(invitationRepository.preload).toHaveBeenCalledWith({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });
            expect(result).toEqual({ status: InvitationStatus.Accepted });
        });
    });

    describe('preview', () => {
        const decodedToken = { sub: 'invite-1', email: 'a@b.com' };

        it('throws NotFoundException when the invitation does not exist', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue(null);

            await expect(service.preview('token')).rejects.toThrow(NotFoundException);
        });

        it('throws ForbiddenException when the invitation is not pending', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });

            await expect(service.preview('token')).rejects.toThrow(ForbiddenException);
        });

        it('returns the public-safe invitation details', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com',
                role: AccountRole.OrganizationMember,
                organization: { name: 'Acme Org' },
                invitedBy: { firstName: 'Jane', lastName: 'Doe' }
            });

            const result = await service.preview('token');

            expect(result).toEqual({
                inviterFirstName: 'Jane',
                inviterLastName: 'Doe',
                role: AccountRole.OrganizationMember,
                organizationName: 'Acme Org',
                invitedEmail: 'a@b.com'
            });
        });

        it('omits organizationName for a platform invitation', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com',
                role: AccountRole.PlatformAgent,
                organization: undefined,
                invitedBy: { firstName: 'Jane', lastName: 'Doe' }
            });

            const result = await service.preview('token');

            expect(result.organizationName).toBeUndefined();
        });
    });

    describe('decline', () => {
        const decodedToken = { sub: 'invite-1', email: 'a@b.com' };

        it('throws NotFoundException when the invitation does not exist', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue(null);

            await expect(service.decline('token')).rejects.toThrow(NotFoundException);
        });

        it('throws ForbiddenException when the invitation is not pending', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });

            await expect(service.decline('token')).rejects.toThrow(ForbiddenException);
        });

        it('marks the invitation Declined on success', async () => {
            authService.decodeTokenInvitation.mockResolvedValue(decodedToken);
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com',
                role: AccountRole.OrganizationMember,
                organization: { id: 'org-1' },
                invitedBy: { id: 'inviter-1' }
            });
            invitationRepository.preload.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Declined
            });
            invitationRepository.save.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Declined
            });

            const result = await service.decline('token');

            expect(invitationRepository.preload).toHaveBeenCalledWith({
                id: 'invite-1',
                status: InvitationStatus.Declined
            });
            expect(invitationRepository.save).toHaveBeenCalledWith({
                id: 'invite-1',
                status: InvitationStatus.Declined
            });
            expect(result).toEqual({ status: InvitationStatus.Declined });
        });
    });

    describe('readOrganizationAll', () => {
        it('returns the pending invitations for the organization', async () => {
            const invitationList = [{ id: 'invite-1' }];
            invitationRepository.find.mockResolvedValue(invitationList);

            const result = await service.readOrganizationAll('org-1');

            expect(invitationRepository.find).toHaveBeenCalledWith({
                where: {
                    expiresAt: MoreThan(expect.any(Date)),
                    organization: { id: 'org-1' },
                    status: InvitationStatus.Pending
                },
                relations: { invitedBy: true },
                select: expect.objectContaining({ invitedBy: { firstName: true, id: true, lastName: true } })
            });
            expect(result).toEqual(invitationList);
        });
    });

    describe('revoke', () => {
        it('throws NotFoundException when the invitation does not exist', async () => {
            invitationRepository.findOne.mockResolvedValue(null);

            await expect(service.revoke('invite-1', 'acc-1')).rejects.toThrow(NotFoundException);
        });

        it('throws ForbiddenException when the invitation is not pending', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });

            await expect(service.revoke('invite-1', 'acc-1')).rejects.toThrow(ForbiddenException);
        });

        it('throws ForbiddenException for an organization:admin who does not belong to the organization', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                organization: { id: 'org-1' }
            });
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1', role: AccountRole.OrganizationAdmin });

            await expect(service.revoke('invite-1', 'acc-1')).rejects.toThrow(ForbiddenException);
            expect(accountRepository.exists).toHaveBeenCalledWith({
                where: { id: 'acc-1', organizationList: { id: 'org-1' } }
            });
        });

        it('lets an organization:admin revoke an invitation for an organization they belong to', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                organization: { id: 'org-1' }
            });
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1', role: AccountRole.OrganizationAdmin });
            accountRepository.exists.mockResolvedValue(true);
            invitationRepository.preload.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Revoked
            });
            invitationRepository.save.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Revoked
            });

            const result = await service.revoke('invite-1', 'acc-1');

            expect(invitationRepository.preload).toHaveBeenCalledWith({
                id: 'invite-1',
                status: InvitationStatus.Revoked
            });
            expect(result).toEqual({ status: InvitationStatus.Revoked });
        });

        it.each([AccountRole.PlatformAdmin, AccountRole.PlatformAgent])(
            'lets a %s revoke a platform invitation with no organization',
            async (role) => {
                invitationRepository.findOne.mockResolvedValue({
                    id: 'invite-1',
                    status: InvitationStatus.Pending,
                    organization: undefined
                });
                accountRepository.findOne.mockResolvedValue({ id: 'acc-1', role });
                invitationRepository.preload.mockResolvedValue({
                    id: 'invite-1',
                    status: InvitationStatus.Revoked
                });
                invitationRepository.save.mockResolvedValue({
                    id: 'invite-1',
                    status: InvitationStatus.Revoked
                });

                const result = await service.revoke('invite-1', 'acc-1');

                expect(accountRepository.exists).not.toHaveBeenCalled();
                expect(result).toEqual({ status: InvitationStatus.Revoked });
            }
        );
    });

    describe('expiry', () => {
        const expired = {
            id: 'invite-1',
            status: InvitationStatus.Pending,
            invitedEmail: 'a@b.com',
            expiresAt: new Date(Date.now() - 1000),
            organization: { id: 'org-1' },
            invitedBy: { id: 'inviter-1' }
        };

        it('refuses an expired invitation by ID, and marks it Expired', async () => {
            invitationRepository.findOne.mockResolvedValue(expired);

            await expect(service.acceptInviteByID('invite-1', 'acc-1')).rejects.toThrow(
                new ForbiddenException('This invitation has expired. Please request a new one.')
            );
            expect(invitationRepository.update).toHaveBeenCalledWith('invite-1', { status: InvitationStatus.Expired });
            expect(accountService.assignRole).not.toHaveBeenCalled();
        });

        it('refuses an expired invitation by token too', async () => {
            authService.decodeTokenInvitation.mockResolvedValue({ sub: 'invite-1' });
            invitationRepository.findOne.mockResolvedValue(expired);

            await expect(service.accept('token', 'acc-1')).rejects.toThrow(ForbiddenException);
            expect(accountService.assignRole).not.toHaveBeenCalled();
        });

        it('refuses to decline an expired invitation by ID', async () => {
            invitationRepository.findOne.mockResolvedValue(expired);

            await expect(service.declineInviteByID('invite-1', 'acc-1')).rejects.toThrow(ForbiddenException);
            expect(invitationRepository.preload).not.toHaveBeenCalled();
        });

        it('accepts an invitation that has not expired yet', async () => {
            invitationRepository.findOne.mockResolvedValue({ ...expired, expiresAt: new Date(Date.now() + 60_000) });
            accountRepository.findOne.mockResolvedValue({ id: 'acc-1', email: 'a@b.com' });
            invitationRepository.preload.mockResolvedValue({ id: 'invite-1' });

            await service.acceptInviteByID('invite-1', 'acc-1');

            expect(invitationRepository.update).not.toHaveBeenCalled();
            expect(accountService.assignRole).toHaveBeenCalled();
        });
    });

    describe('readAccountAll', () => {
        it("returns the signed-in account's pending invitations by its email, without looking it up again", async () => {
            const invitationList = [{ id: 'invite-1' }];
            invitationRepository.find.mockResolvedValue(invitationList);

            const result = await service.readAccountAll({ id: 'acc-1', email: 'a@b.com' } as Account);

            expect(invitationRepository.find).toHaveBeenCalledWith({
                where: {
                    expiresAt: MoreThan(expect.any(Date)),
                    invitedEmail: 'a@b.com',
                    status: InvitationStatus.Pending
                },
                relations: { invitedBy: true, organization: true },
                select: expect.objectContaining({ invitedBy: { firstName: true, id: true, lastName: true } })
            });
            expect(accountRepository.findOne).not.toHaveBeenCalled();
            expect(result).toEqual(invitationList);
        });
    });

    describe('acceptInviteByID', () => {
        it('throws NotFoundException when the invitation does not exist', async () => {
            invitationRepository.findOne.mockResolvedValue(null);

            await expect(service.acceptInviteByID('invite-1', 'acc-1')).rejects.toThrow(NotFoundException);
        });

        it('throws ForbiddenException when the invitation is not pending', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });

            await expect(service.acceptInviteByID('invite-1', 'acc-1')).rejects.toThrow(ForbiddenException);
        });

        it('throws NotFoundException when the accepting account does not exist', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com'
            });
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.acceptInviteByID('invite-1', 'acc-1')).rejects.toThrow(NotFoundException);
        });

        it('throws ForbiddenException when the account email does not match the invite', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com'
            });
            accountRepository.findOne.mockResolvedValue({
                id: 'acc-1',
                email: 'someone-else@b.com'
            });

            await expect(service.acceptInviteByID('invite-1', 'acc-1')).rejects.toThrow(ForbiddenException);
        });

        it('joins the organization, offers the role, and marks the invitation Accepted', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com',
                role: AccountRole.OrganizationMember,
                organization: { id: 'org-1' },
                invitedBy: { id: 'inviter-1' }
            });
            accountRepository.findOne.mockResolvedValue({
                id: 'acc-1',
                email: 'a@b.com'
            });
            invitationRepository.preload.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });
            invitationRepository.save.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });

            const result = await service.acceptInviteByID('invite-1', 'acc-1');

            expect(accountService.assignRole).toHaveBeenCalledWith('acc-1', AccountRole.OrganizationMember, 'org-1');
            expect(result).toEqual({ status: InvitationStatus.Accepted });
        });
    });

    describe('declineInviteByID', () => {
        it('throws NotFoundException when the invitation does not exist', async () => {
            invitationRepository.findOne.mockResolvedValue(null);

            await expect(service.declineInviteByID('invite-1', 'acc-1')).rejects.toThrow(NotFoundException);
        });

        it('throws ForbiddenException when the invitation is not pending', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Accepted
            });

            await expect(service.declineInviteByID('invite-1', 'acc-1')).rejects.toThrow(ForbiddenException);
        });

        it('throws NotFoundException when the requesting account does not exist', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com'
            });
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.declineInviteByID('invite-1', 'acc-1')).rejects.toThrow(NotFoundException);
        });

        it('throws ForbiddenException when the account email does not match the invite', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com'
            });
            accountRepository.findOne.mockResolvedValue({
                id: 'acc-1',
                email: 'someone-else@b.com'
            });

            await expect(service.declineInviteByID('invite-1', 'acc-1')).rejects.toThrow(ForbiddenException);
        });

        it('marks the invitation Declined on success', async () => {
            invitationRepository.findOne.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Pending,
                invitedEmail: 'a@b.com'
            });
            accountRepository.findOne.mockResolvedValue({
                id: 'acc-1',
                email: 'a@b.com'
            });
            invitationRepository.preload.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Declined
            });
            invitationRepository.save.mockResolvedValue({
                id: 'invite-1',
                status: InvitationStatus.Declined
            });

            const result = await service.declineInviteByID('invite-1', 'acc-1');

            expect(invitationRepository.preload).toHaveBeenCalledWith({
                id: 'invite-1',
                status: InvitationStatus.Declined
            });
            expect(result).toEqual({ status: InvitationStatus.Declined });
        });
    });
});
