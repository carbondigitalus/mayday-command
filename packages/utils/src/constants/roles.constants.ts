// Custom Modules
import AccountRole from '../enums/AccountRole.enum';

/** Roles that run the install rather than belong to a customer organization. They reach every organization's routes
 * without being a member. */
export const platformRoles: AccountRole[] = [AccountRole.PlatformAdmin, AccountRole.PlatformAgent];

/** Roles that manage a customer organization: its own organization admins (who must belong to it) and platform
 * staff (who reach every organization). */
export const organizationManagerRoles: AccountRole[] = [AccountRole.OrganizationAdmin, ...platformRoles];

/** Roles that let an account skip the "you need an org" prompt even with zero organizations: staff access the
 * platform through their staff role, not a personally-owned organization. */
export const staffAccessRoles: AccountRole[] = [AccountRole.PlatformAdmin];
