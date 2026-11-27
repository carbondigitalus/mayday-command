// NPM Modules
import { IsBoolean, IsDate, IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import 'reflect-metadata';

// Custom Modules
import Organization from './Organization.dto';
import AccountRole from '../enums/AccountRole.enum';
import AccountVerifications from '../interfaces/AccountVerifications.interface';

export default class Account {
    @IsNotEmpty()
    id: string;

    @IsString()
    firstName?: string;

    @IsString()
    lastName?: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsBoolean()
    isActive: boolean;

    /** The account's one role. Null until an invitation, an admin or first-admin setup gives it one. */
    @IsEnum(AccountRole)
    role?: AccountRole | null;

    @IsString()
    password: string;

    @IsDate()
    passwordChangedAt?: Date;

    @IsString()
    passwordResetToken?: string;

    /** When the account last passed 2FA, or verified its email. Drives the 30-day login re-check. */
    @IsDate()
    lastMFAValidatedAt?: Date;

    verifications?: AccountVerifications;

    createdOn?: Date;
    updatedOn?: Date;

    /** Every {@link Organization} this account belongs to. */
    organizationList?: Organization[];
}
