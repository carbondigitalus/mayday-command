// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

/** The role requirement {@link RequiresRole} attaches to a route. */
export default interface RequiresRoleMetadata {
    /** The role, or roles, any one of which the account must hold. */
    role: AccountRole | AccountRole[];
    /** The route param holding an organization's ID, when the route acts on one organization. */
    resourceParam?: string;
}
