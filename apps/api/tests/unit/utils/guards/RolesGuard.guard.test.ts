// NPM Modules
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import Account from 'src/database/account.entity';
import RolesGuard from 'src/utils/guards/RolesGuard.guard';
import RequiresRoleMetadata from 'src/utils/interfaces/RequiresRoleMetadata.interface';

describe('RolesGuard', () => {
    let accountRepository: { exists: jest.Mock };
    let reflector: { get: jest.Mock };
    let guard: RolesGuard;

    const buildContext = (request: { account?: Partial<Account>; params?: Record<string, string> }) =>
        ({
            getHandler: () => undefined,
            switchToHttp: () => ({ getRequest: () => request })
        }) as unknown as ExecutionContext;

    const requireRole = (requirement: RequiresRoleMetadata | undefined) => reflector.get.mockReturnValue(requirement);

    beforeEach(() => {
        accountRepository = { exists: jest.fn().mockResolvedValue(false) };
        reflector = { get: jest.fn() };
        guard = new RolesGuard(reflector as unknown as Reflector, accountRepository as unknown as Repository<Account>);
    });

    it('lets a route with no requirement through', async () => {
        requireRole(undefined);

        await expect(guard.canActivate(buildContext({}))).resolves.toBe(true);
    });

    it('refuses a request with no signed-in account', async () => {
        requireRole({ role: AccountRole.PlatformAdmin });

        await expect(guard.canActivate(buildContext({}))).rejects.toThrow(
            new ForbiddenException('Authentication required.')
        );
    });

    it("lets an account through when its role is the route's role", async () => {
        requireRole({ role: AccountRole.PlatformAdmin });

        await expect(
            guard.canActivate(buildContext({ account: { id: 'acc-1', role: AccountRole.PlatformAdmin } }))
        ).resolves.toBe(true);
    });

    it('lets an account through when its role is any of the listed roles', async () => {
        requireRole({ role: [AccountRole.PlatformAdmin, AccountRole.PlatformAgent] });

        await expect(
            guard.canActivate(buildContext({ account: { id: 'acc-1', role: AccountRole.PlatformAgent } }))
        ).resolves.toBe(true);
    });

    it('refuses an account with a different role', async () => {
        requireRole({ role: AccountRole.PlatformAdmin });

        await expect(
            guard.canActivate(buildContext({ account: { id: 'acc-1', role: AccountRole.PlatformAgent } }))
        ).rejects.toThrow(ForbiddenException);
    });

    it('refuses an account with no role', async () => {
        requireRole({ role: AccountRole.OrganizationMember });

        await expect(guard.canActivate(buildContext({ account: { id: 'acc-1', role: null } }))).rejects.toThrow(
            ForbiddenException
        );
    });

    describe('on a route for one organization', () => {
        const requirement = {
            resourceParam: 'organizationID',
            role: [AccountRole.OrganizationAdmin, AccountRole.PlatformAdmin]
        };

        it('lets an organization role through when the account belongs to that organization', async () => {
            requireRole(requirement);
            accountRepository.exists.mockResolvedValue(true);

            await expect(
                guard.canActivate(
                    buildContext({
                        account: { id: 'acc-1', role: AccountRole.OrganizationAdmin },
                        params: { organizationID: 'org-1' }
                    })
                )
            ).resolves.toBe(true);
            expect(accountRepository.exists).toHaveBeenCalledWith({
                where: { id: 'acc-1', organizationList: { id: 'org-1' } }
            });
        });

        it("refuses an organization role when the account doesn't belong to that organization", async () => {
            requireRole(requirement);

            await expect(
                guard.canActivate(
                    buildContext({
                        account: { id: 'acc-1', role: AccountRole.OrganizationAdmin },
                        params: { organizationID: 'org-2' }
                    })
                )
            ).rejects.toThrow(ForbiddenException);
        });

        it('lets a platform role through without checking membership', async () => {
            requireRole(requirement);

            await expect(
                guard.canActivate(
                    buildContext({
                        account: { id: 'acc-1', role: AccountRole.PlatformAdmin },
                        params: { organizationID: 'org-1' }
                    })
                )
            ).resolves.toBe(true);
            expect(accountRepository.exists).not.toHaveBeenCalled();
        });

        it('refuses an organization role when the route has no organization ID', async () => {
            requireRole(requirement);

            await expect(
                guard.canActivate(buildContext({ account: { id: 'acc-1', role: AccountRole.OrganizationAdmin } }))
            ).rejects.toThrow(ForbiddenException);
            expect(accountRepository.exists).not.toHaveBeenCalled();
        });
    });
});
