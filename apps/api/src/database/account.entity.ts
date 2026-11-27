// NPM Modules
import { IsBoolean, IsDate, IsEmail, IsEnum, IsNotEmpty, IsString, IsPhoneNumber, IsNumber } from 'class-validator';
import { Exclude } from 'class-transformer';
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import 'reflect-metadata';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';
import AccountVerifications from '@mayday-command/utils/interfaces/AccountVerifications.interface';

// Custom Modules
import Organization from './organization.entity';
import StrongPassword from 'src/utils/decorators/StrongPassword.decorator';

/** A person who signs in to Mayday Command. What they can do comes from their one {@link AccountRole}, and which
 * customer organizations they belong to from {@link Account.organizationList}. */
@Entity()
export default class Account {
    /** Primary key. */
    @PrimaryGeneratedColumn('uuid')
    @IsNotEmpty()
    id: string;

    /** Given name. */
    @Column()
    @IsString()
    firstName: string;

    /** Family name. */
    @Column()
    @IsString()
    lastName: string;

    /** Sign-in email address, unique across accounts. Lowercased at registration. */
    @Column({ unique: true })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    /** Contact phone number. Not yet verified or used by any flow. */
    @Column({ nullable: true })
    @IsPhoneNumber()
    phone?: string;

    /** Whether the account may be used. A deactivated account can't sign in, and its existing sessions are refused. */
    @Column({
        type: 'boolean',
        default: true
    })
    @IsBoolean()
    isActive: boolean;

    /** The account's one role. Null until an invitation, an admin or first-admin setup gives it one; an account with
     * no role can sign in but reaches no role-protected route. */
    @Column({ type: 'enum', enum: AccountRole, nullable: true, default: null })
    @IsEnum(AccountRole)
    role?: AccountRole | null;

    /** Argon2 hash of the account's password. Never serialized: `select: false` only keeps it out of queries, not out
     * of the entity `save()` returns (e.g. from `register`). */
    @Exclude()
    @Column({ select: false })
    @StrongPassword()
    password: string;

    /** When the password was last changed or reset. Sessions issued before it are refused, so a change ends every
     * other session. */
    @Column({ type: 'timestamp', nullable: true, default: null })
    @IsDate()
    passwordChangedAt?: Date;

    /** The argon2 hash of the encrypted reset token in the latest password reset email, so a leaked row can't be used
     * to reset the password. Never serialized, and out of default selects so it never leaves the API. */
    @Exclude()
    @Column({ default: null, select: false })
    @IsString()
    passwordResetToken?: string;

    /** Wrong current passwords given to the password change since the last
     * success or lockout. */
    @Exclude()
    @Column({ type: 'int', default: 0, select: false })
    @IsNumber()
    passwordChangeAttempts: number;

    /** Password changes are refused until this time, after too many wrong
     * current passwords. */
    @Exclude()
    @Column({ type: 'timestamp', nullable: true, default: null, select: false })
    @IsDate()
    passwordChangeLockedUntil?: Date | null;

    /** Wrong passwords given at login since the last success or lockout. */
    @Exclude()
    @Column({ type: 'int', default: 0, select: false })
    @IsNumber()
    loginAttempts: number;

    /** Logins are refused until this time, after too many wrong passwords. */
    @Exclude()
    @Column({ type: 'timestamp', nullable: true, default: null, select: false })
    @IsDate()
    loginLockedUntil?: Date | null;

    /** When the account last signed in: when a session was issued at login or password reset, or a 2FA code was
     * accepted. Null means never. */
    @Column({ type: 'timestamp', nullable: true, default: null })
    @IsDate()
    lastLoginAt?: Date | null;

    /** When the account last passed 2FA at login, or verified its email.
     * Login asks for a second factor again once this is older than
     * `MFA_REVALIDATION_DAYS`. Null means never. */
    @Column({ type: 'timestamp', nullable: true, default: null })
    @IsDate()
    lastMFAValidatedAt?: Date | null;

    /** Verification status, provider and date per verified contact method: email today, phone later. */
    @Column({ type: 'jsonb', nullable: true, default: null })
    verifications?: AccountVerifications;

    /** Argon2 hash of the pending email verification code. Only email verification uses these three columns; login
     * 2FA codes live in their own `MFAChallenge` table. The account holds one pending code at a time, so when phone
     * verification arrives, these should move into a table of their own rather than gain phone copies. Transient
     * challenge state, kept out of `verifications` (which is returned to the browser) and out of default selects so the
     * hash never leaves the API. */
    @Exclude()
    @Column({ type: 'varchar', nullable: true, default: null, select: false })
    @IsString()
    oneTimePasscode?: string | null;

    /** When the pending email verification code stops working. Null when no code is pending. */
    @Exclude()
    @Column({ type: 'timestamp', nullable: true, default: null, select: false })
    @IsDate()
    oneTimePasscodeExpiration?: Date | null;

    /** Wrong guesses against the current email verification code; reset whenever a new one is issued. */
    @Exclude()
    @Column({ type: 'int', default: 0, select: false })
    @IsNumber()
    oneTimePasscodeAttempts: number;

    /** Timestamp the account was created. */
    @CreateDateColumn()
    createdOn: Date;

    /** Timestamp the account was last updated. */
    @UpdateDateColumn()
    updatedOn: Date;

    /** Every customer {@link Organization} this account belongs to. Stored in a join table, not a column here. */
    @ManyToMany(() => Organization, (organization) => organization.accountList)
    @JoinTable()
    organizationList?: Organization[];
}
