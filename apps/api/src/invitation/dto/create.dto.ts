// NPM Modules
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

/** Invites `invitedEmail` to `role`. An organization invitation (made through the organization route, see
 * `InvitationController`) must offer an organization role, and a platform invitation a platform role. */
export default class InvitationCreateDTO {
    @IsEmail()
    @IsNotEmpty()
    invitedEmail: string;

    @IsEnum(AccountRole)
    @IsNotEmpty()
    role: AccountRole;
}
