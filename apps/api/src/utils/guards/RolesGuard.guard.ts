// NPM Modules
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Shared Modules
import { platformRoles } from '@mayday-command/utils/constants/roles.constants';

// Custom Modules
import Account from 'src/database/account.entity';
import requiresRoleKey from 'src/utils/constants/role';
import RequiresRoleMetadata from 'src/utils/interfaces/RequiresRoleMetadata.interface';

/** Authorizes a request by the signed-in account's role, read from the `@RequiresRole` requirement: an array means
 * "any of these". When the route names an organization, an organization role must also belong to it, while platform
 * roles reach every organization. Routes with no `@RequiresRole` pass through. */
@Injectable()
export default class RolesGuard implements CanActivate {
    /** The reflector, plus the account repository for organization membership checks. */
    constructor(
        private reflector: Reflector,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>
    ) {}

    /** Denies the request unless the account's role is one the route requires, and, for an organization route, the
     * account is a platform role or belongs to that organization. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requirement = this.reflector.get<RequiresRoleMetadata | undefined>(requiresRoleKey, context.getHandler());

        if (!requirement) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const account = request.account as Account | undefined;

        if (!account) {
            throw new ForbiddenException('Authentication required.');
        }

        const roles = Array.isArray(requirement.role) ? requirement.role : [requirement.role];

        if (!account.role || !roles.includes(account.role)) {
            throw new ForbiddenException('You do not have the required role for this action.');
        }

        if (!requirement.resourceParam || platformRoles.includes(account.role)) {
            return true;
        }

        const organizationID = request.params?.[requirement.resourceParam] as string | undefined;

        const isMember =
            !!organizationID &&
            (await this.accountRepository.exists({
                where: { id: account.id, organizationList: { id: organizationID } }
            }));

        if (!isMember) {
            throw new ForbiddenException('You do not have the required role for this action.');
        }

        return true;
    }
}
