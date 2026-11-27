// NPM Modules
import { IsEnum, IsNotEmpty } from 'class-validator';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

/** The body of `PATCH /account/admin/:accountID/role`. */
export default class AccountRoleChangeDTO {
    /** The account's new role. */
    @IsEnum(AccountRole)
    @IsNotEmpty()
    role: AccountRole;
}
