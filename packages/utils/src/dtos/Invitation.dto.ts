// NPM Modules
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import 'reflect-metadata';

// Custom Modules
import Account from './Account.dto';
import Organization from './Organization.dto';
import AccountRole from '../enums/AccountRole.enum';
import InvitationStatus from '../enums/InvitationStatus.enum';

/** An offer of a role, optionally into an organization, sent to an email address that may not have an Account yet. */
export default class Invitation {
    @IsNotEmpty()
    id?: string;

    @IsEmail()
    invitedEmail?: string;

    @IsEnum(InvitationStatus)
    status?: InvitationStatus;

    expiresAt?: Date;

    invitedBy?: Account;
    @IsEnum(AccountRole)
    role?: AccountRole;
    /** The organization the invitee joins on accepting. Empty for a platform invitation. */
    organization?: Organization;

    createdOn?: Date;
    updatedOn?: Date;
}
