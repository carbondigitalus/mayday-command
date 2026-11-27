// NPM Modules
import { SetMetadata } from '@nestjs/common';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import requiresRoleKey from '../constants/role';

/** Marks a route as requiring the account's role to be `role`, or one of them when it's an array. When
 * `resourceParam` names a route param holding an organization's ID (e.g. `'organizationID'`), an organization role
 * must also belong to that organization; platform roles reach every organization. Enforced by `RolesGuard`. */
const RequiresRole = (role: AccountRole | AccountRole[], resourceParam?: string) =>
    SetMetadata(requiresRoleKey, { role, resourceParam });

export default RequiresRole;
