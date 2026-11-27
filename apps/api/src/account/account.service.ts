// NPM Modules
import {
    ConflictException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    NotFoundException
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon from 'argon2';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { FindOptionsWhere, IsNull, QueryFailedError, Raw, Repository } from 'typeorm';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import AccountLoginDTO from './dto/login.dto';
import AccountPasswordChangeDTO from './dto/password-change.dto';
import AccountPasswordForgotDTO from './dto/password-forgot.dto';
import AccountPasswordResetDTO from './dto/password-reset.dto';
import AccountRegisterDTO from './dto/register.dto';
import AccountUpdateDTO from './dto/update.dto';
import AuthService from 'src/auth/auth.service';
import Account from 'src/database/account.entity';
import LoggerService from 'src/logger/logger.service';
import MFAService from 'src/mfa/mfa.service';
import TooManyRequestsException from 'src/utils/exceptions/TooManyRequests.exception';
import VerificationService from 'src/verification/verification.service';

/** Postgres advisory lock key held for the length of first-admin setup, so two setup requests on a fresh install
 * can't both become the admin. Any fixed number works; it only has to be the same for every setup request. */
const setupAdminLockKey = 4_031_998;

/** Everyone who asks for a password reset gets this answer, whether or not the email belongs to an account. */
const passwordForgotMessage = 'If an account exists for that email, please check your inbox for instructions.';

/** Account lifecycle and credentials: activation, login with lockout, password change/forgot/reset, registration, and
 * the platform:admin account tooling. Every password written here is an argon2 hash. */
@Injectable()
export default class AccountService {
    /** How long an account stays locked after too many incorrect passwords, in milliseconds. */
    static readonly lockoutMS = 15 * 60 * 1000;
    /** Incorrect passwords allowed before the account locks. */
    static readonly maxPasswordAttempts = 5;

    /** The account repository and email queue, plus the auth, MFA, logger and verification services. */
    constructor(
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        private authService: AuthService,
        @InjectQueue('email') private emailQueue: Queue,
        private logger: LoggerService,
        private mfaService: MFAService,
        private verificationService: VerificationService
    ) {}

    /** Marks the account active. `performedBy` is only for the log, to say who did it.
     * @throws NotFoundException when no account has `data.id`. */
    async activate(data: { id: string }, performedBy?: string) {
        const logContext = 'AccountService-activate';

        const user = await this.accountRepository.findOne({
            where: {
                id: data.id
            }
        });

        if (!user) {
            this.logger.warn(`Attempt to activate non-existent account: ${data.id}`, logContext);
            throw new NotFoundException('Account not found.');
        }

        const updatedUser = await this.accountRepository.preload({
            id: user.id,
            isActive: true
        });

        const result = await this.accountRepository.save(updatedUser);

        this.logger.debug(
            `Account activated successfully: ${data.id}${performedBy ? ` (performed by ${performedBy})` : ''}`,
            logContext
        );

        return result;
    }

    /** Marks the account inactive. `performedBy` is only for the log, to say who did it.
     * @throws NotFoundException when no account has `data.id`. */
    async deactivate(data: { id: string }, performedBy?: string) {
        const logContext = 'AccountService-deactivate';

        const user = await this.accountRepository.findOne({
            where: {
                id: data.id
            }
        });

        if (!user) {
            this.logger.warn(`Attempt to deactivate non-existent account: ${data.id}`, logContext);
            throw new NotFoundException('Account not found.');
        }

        const updatedUser = await this.accountRepository.preload({
            id: user.id,
            isActive: false
        });

        const result = await this.accountRepository.save(updatedUser);

        this.logger.debug(
            `Account deactivated successfully: ${data.id}${performedBy ? ` (performed by ${performedBy})` : ''}`,
            logContext
        );

        return result;
    }

    /** Case-insensitive search across email/firstName/lastName plus exact
     * filters, for the platform:admin account-administration UI. */
    async adminSearch(query: { search?: string; isActive?: string; page?: string; limit?: string }) {
        const logContext = 'AccountService-adminSearch';

        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 25;

        const filters: FindOptionsWhere<Account> = {};
        if (query.isActive !== undefined) filters.isActive = query.isActive === 'true';

        const searchTerm = query.search?.trim();
        const where: FindOptionsWhere<Account> | FindOptionsWhere<Account>[] = searchTerm
            ? (['email', 'firstName', 'lastName'] as const).map((field) => ({
                  ...filters,
                  [field]: Raw((alias) => `LOWER(${alias}) LIKE LOWER(:term)`, { term: `%${searchTerm}%` })
              }))
            : filters;

        const [data, total] = await this.accountRepository.findAndCount({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isActive: true,
                role: true
            },
            skip: (page - 1) * limit,
            take: limit
        });

        this.logger.debug(`Admin search returned ${data.length} of ${total} account(s).`, logContext);

        return { data, total, page, limit };
    }

    /** Full account detail lookup by id, with its role and the organizations it belongs to, for the platform:admin
     * account-administration UI. */
    async adminFindOne(accountID: string) {
        const logContext = 'AccountService-adminFindOne';

        const account = await this.accountRepository.findOne({
            where: { id: accountID },
            relations: { organizationList: true }
        });

        if (!account) {
            this.logger.warn(`Attempt to view non-existent account: ${accountID}`, logContext);
            throw new NotFoundException('Account not found.');
        }

        this.logger.debug(`Successfully retrieved account: ${accountID}`, logContext);

        return account;
    }

    /** Checks the email and password and returns a session, or a second-factor challenge when 2FA has lapsed.
     *
     * Checks run in this order, each refusing before the more expensive one after it: a locked account is refused
     * before any hashing, so a guesser gains nothing by retrying and we spend nothing checking. The attempt is
     * reserved before the password is compared, so parallel guesses can't all read the same count.
     *
     * @throws ForbiddenException with the generic "Email or password incorrect." for an unknown email or wrong
     * password, or "Account is deactivated.".
     * @throws TooManyRequestsException when the account is locked, or this attempt reached
     * {@link AccountService.maxPasswordAttempts}. */
    async login(data: AccountLoginDTO, res: Response) {
        const logContext = 'AccountService-login';

        if (!data.email) {
            this.logger.warn('Login attempt with no data provided.', logContext);
            throw new ForbiddenException('Data missing.');
        }

        const account = await this.accountRepository.findOne({
            where: {
                email: data.email.toLowerCase()
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                password: true,
                isActive: true,
                verifications: true,
                lastMFAValidatedAt: true,
                loginLockedUntil: true
            }
        });

        if (!account) {
            this.logger.warn('Login attempt failed: No account has that email.', logContext);
            throw new ForbiddenException('Email or password incorrect.');
        }

        if (account.loginLockedUntil && account.loginLockedUntil.getTime() > Date.now()) {
            this.logger.warn(`Login refused for ${account.id}: Locked after too many attempts.`, logContext);
            throw this.lockedException(account.loginLockedUntil);
        }

        const attempts = await this.reservePasswordAttempt(account.id, 'loginAttempts');

        const passwordValidateSuccess = await argon.verify(account.password, data.password);

        if (!passwordValidateSuccess) {
            this.logger.warn(`Login attempt for ${account.id} failed: Incorrect password.`, logContext);

            if (attempts >= AccountService.maxPasswordAttempts) {
                const lockedUntil = new Date(Date.now() + AccountService.lockoutMS);

                await this.accountRepository.update(account.id, { loginAttempts: 0, loginLockedUntil: lockedUntil });
                throw this.lockedException(lockedUntil);
            }

            throw new ForbiddenException('Email or password incorrect.');
        }

        await this.accountRepository.update(account.id, { loginAttempts: 0, loginLockedUntil: null });

        if (!account.isActive) {
            this.logger.warn(`Login attempt for ${account.id} refused: Account is deactivated.`, logContext);
            throw new ForbiddenException('Account is deactivated.');
        }

        const session = await this.completeLogin(account, res);

        this.logger.debug(`Login successful for ${account.id}`, logContext);

        return session;
    }

    /** The one place a verified password becomes a session. When 2FA has
     * lapsed it returns a challenge and issues no cookie, so nothing that
     * reads the session cookie ever sees an account that skipped it. A session
     * issued here records `lastLoginAt`; after a challenge, MFA verification does. */
    private async completeLogin(account: Account, res: Response) {
        if (this.mfaService.isChallengeRequired(account)) {
            return this.mfaService.startChallenge(account);
        }

        await this.accountRepository.update(account.id, { lastLoginAt: new Date() });

        return this.authService.createCookieLogin(account, res);
    }

    /** Clears the session cookie. */
    logout(res: Response) {
        const logContext = 'AccountService-logout';

        const result = this.authService.createCookieLogout(res);

        this.logger.debug('User logged out successfully', logContext);

        return result;
    }

    /** Changes the password of the account making the request. The account comes from the session (`accountID`),
     * never from the request, so one account can't set another's password.
     *
     * The current password has to be given as well as an open session, and wrong guesses are counted and locked out
     * like login's, so a stolen session can't be used to guess it. The count is reserved before the check, so
     * parallel guesses can't all read the same count.
     * @throws ForbiddenException when the account no longer exists, a password is wrong, the new and confirmed
     * passwords differ, or the new one equals the current one.
     * @throws TooManyRequestsException when locked. */
    async passwordChange(accountID: string, data: AccountPasswordChangeDTO, res: Response) {
        const logContext = 'AccountService-passwordChange';

        const account = await this.accountRepository.findOne({
            where: { id: accountID },
            select: { id: true, email: true, password: true, passwordChangeLockedUntil: true }
        });

        if (!account) {
            this.logger.warn(`Password change attempt failed: No account found for ID: ${accountID}`, logContext);
            throw new ForbiddenException('Unable to find user.');
        }

        if (account.passwordChangeLockedUntil && account.passwordChangeLockedUntil.getTime() > Date.now()) {
            this.logger.warn(`Password change refused for ${account.id}: Locked after too many attempts.`, logContext);
            throw this.lockedException(account.passwordChangeLockedUntil);
        }

        const attempts = await this.reservePasswordAttempt(account.id, 'passwordChangeAttempts');

        if (!(await argon.verify(account.password, data.currentPassword))) {
            this.logger.warn(`Password change failed for ${account.id}: Current password is incorrect.`, logContext);

            if (attempts >= AccountService.maxPasswordAttempts) {
                const lockedUntil = new Date(Date.now() + AccountService.lockoutMS);

                await this.accountRepository.update(account.id, {
                    passwordChangeAttempts: 0,
                    passwordChangeLockedUntil: lockedUntil
                });
                throw this.lockedException(lockedUntil);
            }

            throw new ForbiddenException(
                `Current password is incorrect. ${AccountService.maxPasswordAttempts - attempts} attempts remaining.`
            );
        }

        await this.accountRepository.update(account.id, { passwordChangeAttempts: 0, passwordChangeLockedUntil: null });

        if (data.password !== data.passwordConfirm) {
            this.logger.warn(`Password change failed for ${account.id}: Passwords do not match.`, logContext);
            throw new ForbiddenException('Passwords do not match.');
        }

        if (data.password === data.currentPassword) {
            this.logger.warn(
                `Password change failed for ${account.id}: New password matches the current one.`,
                logContext
            );
            throw new ForbiddenException('New password must be different from your current password.');
        }

        const hashedPassword = await argon.hash(data.password);

        const updatedAccount = await this.accountRepository.preload({
            id: account.id,
            password: hashedPassword,
            passwordChangedAt: new Date()
        });

        await this.accountRepository.save(updatedAccount);

        await this.emailQueue.add('password-reset-done', {
            firstName: updatedAccount.firstName,
            lastName: updatedAccount.lastName,
            email: updatedAccount.email
        });
        this.logger.debug(`Password updated successfully for ${account.id}`, logContext);

        return this.authService.createCookieLogin(account, res);
    }

    /** Atomic, so concurrent guesses can't each read the same count and slip
     * past the cap. Returns the post-increment value. */
    private async reservePasswordAttempt(id: string, column: 'loginAttempts' | 'passwordChangeAttempts') {
        const result = await this.accountRepository
            .createQueryBuilder()
            .update(Account)
            .set({ [column]: () => `"${column}" + 1` })
            .where('id = :id', { id })
            .returning(`"${column}"`)
            .execute();

        return (result.raw as Array<Record<typeof column, number>>)[0][column];
    }

    /** The 429 for a locked account, with how long to wait in `retryAfterSeconds` for the client to show. */
    private lockedException(lockedUntil: Date) {
        const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));

        return new TooManyRequestsException(
            `Too many incorrect passwords. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
            retryAfterSeconds
        );
    }

    /** Emails a password reset link to the account, if there is one. The answer is the same for an unknown email,
     * so the response can't be used to find out which emails exist, and the token goes to the account's inbox only,
     * never into this response. */
    async passwordForgot(data: AccountPasswordForgotDTO) {
        const logContext = 'AccountService-passwordForgot';

        const account = await this.accountRepository.findOne({
            where: { email: data.email.toLowerCase() }
        });

        if (!account) {
            this.logger.warn('Password reset requested: No account has that email.', logContext);
            return { message: passwordForgotMessage };
        }

        const token = await this.authService.generateTokenPasswordReset(account.id);

        const updatedAccount = await this.accountRepository.preload({
            id: account.id,
            passwordResetToken: await argon.hash(token.passwordResetToken)
        });

        await this.accountRepository.save(updatedAccount);

        await this.emailQueue.add('password-reset-init', {
            firstName: updatedAccount.firstName,
            lastName: updatedAccount.lastName,
            email: updatedAccount.email,
            token: token.passwordResetToken
        });
        this.logger.debug(`Password reset token generated and email queued for ${account.id}`, logContext);

        return { message: passwordForgotMessage };
    }

    /** Sets a new password from the emailed reset token in `data.token` and signs the account in. The token is
     * decrypted and verified as a JWT, then checked against the argon2 hash stored when it was issued, so only the
     * account's latest link works, and only once. A deactivated account is refused before anything changes, the same as
     * at login. A successful reset also clears any login lockout, since the new password was set through the account's
     * own email.
     * @throws ForbiddenException when the token is invalid, expired or no longer current, the account is deactivated,
     * or the passwords differ. */
    async passwordReset(data: AccountPasswordResetDTO, res: Response) {
        const logContext = 'AccountService-passwordReset';

        const decoded = await this.authService.decodeTokenPasswordReset(data.token);

        const account = await this.accountRepository
            .createQueryBuilder('account')
            .addSelect('account.passwordResetToken')
            .where('account.id = :id', { id: decoded.sub })
            .getOne();

        if (!account?.passwordResetToken || !(await argon.verify(account.passwordResetToken, data.token))) {
            this.logger.warn(`Password reset refused for ${decoded.sub}: Token is not the current one.`, logContext);
            throw new ForbiddenException('This reset link is no longer valid. Try forgot password again.');
        }

        if (!account.isActive) {
            this.logger.warn(`Password reset refused for ${account.id}: Account is deactivated.`, logContext);
            throw new ForbiddenException('Account is deactivated.');
        }

        if (data.password !== data.passwordConfirm) {
            this.logger.warn(`Password reset attempt for ${account.id} failed: Passwords do not match.`, logContext);
            throw new ForbiddenException('Passwords do not match.');
        }

        const hashedPassword = await argon.hash(data.password);

        const updatedAccount = await this.accountRepository.preload({
            id: account.id,
            password: hashedPassword,
            passwordChangedAt: new Date(),
            passwordResetToken: null,
            loginAttempts: 0,
            loginLockedUntil: null
        });

        await this.accountRepository.save(updatedAccount);

        await this.emailQueue.add('password-reset-done', {
            firstName: updatedAccount.firstName,
            lastName: updatedAccount.lastName,
            email: updatedAccount.email
        });
        this.logger.debug(`Password reset successful for ${account.id}`, logContext);

        return this.completeLogin(account, res);
    }

    /** Sets an account's role. platform:admin only, enforced by the controller. Since an account holds one role across
     * all its organizations, only platform admins change it. The install must keep at least one platform:admin, so
     * the last one can't be changed to another role; the platform admins are locked for the length of the check, so
     * two admins changing each other at once can't leave none.
     * @throws NotFoundException when the account doesn't exist.
     * @throws ForbiddenException when it would remove the install's last platform:admin. */
    async changeRole(accountID: string, role: AccountRole) {
        const logContext = 'AccountService-changeRole';

        await this.accountRepository.manager.transaction(async (manager) => {
            const account = await manager.findOne(Account, { where: { id: accountID } });

            if (!account) {
                this.logger.warn(`Role change failed: Account not found for ID: ${accountID}`, logContext);
                throw new NotFoundException('Account not found.');
            }

            if (account.role === AccountRole.PlatformAdmin && role !== AccountRole.PlatformAdmin) {
                const platformAdminList = await manager.find(Account, {
                    where: { role: AccountRole.PlatformAdmin },
                    select: { id: true },
                    lock: { mode: 'pessimistic_write' }
                });

                if (platformAdminList.length <= 1) {
                    this.logger.warn(`Role change refused: ${accountID} is the last platform:admin`, logContext);
                    throw new ForbiddenException('The install must keep at least one platform admin.');
                }
            }

            await manager.update(Account, accountID, { role });
        });

        this.logger.log(`Role of account ${accountID} changed to ${role}`, logContext);

        return { id: accountID, role };
    }

    /** Whether the install still needs its first platform:admin, so the portal knows to show first-run setup. */
    async isSetupAdminRequired() {
        const hasAdmin = await this.accountRepository.exists({ where: { role: AccountRole.PlatformAdmin } });

        return { setupRequired: !hasAdmin };
    }

    /** Creates the install's first account as platform:admin and signs it in. It works only while no platform:admin
     * exists: the check and the insert run in one transaction holding a Postgres advisory lock, so two requests at
     * once can't both succeed. Email verification starts the same way as at registration.
     * @throws ForbiddenException when the passwords differ or the email is already used.
     * @throws ConflictException once a platform:admin exists. */
    async setupAdmin(data: AccountRegisterDTO, res: Response) {
        const logContext = 'AccountService-setupAdmin';

        if (data.password !== data.passwordConfirm) {
            this.logger.warn('Admin setup failed: Passwords do not match.', logContext);
            throw new ForbiddenException('Passwords do not match.');
        }

        const email = data.email.toLowerCase();
        const password = await argon.hash(data.password);

        const account = await this.accountRepository.manager.transaction(async (manager) => {
            await manager.query('SELECT pg_advisory_xact_lock($1)', [setupAdminLockKey]);

            if (await manager.exists(Account, { where: { role: AccountRole.PlatformAdmin } })) {
                this.logger.warn('Admin setup refused: The install already has an admin.', logContext);
                throw new ConflictException('This install already has an admin.');
            }

            if (await manager.exists(Account, { where: { email } })) {
                this.logger.warn('Admin setup refused: The email is already used.', logContext);
                throw new ForbiddenException('An account already uses this email address.');
            }

            return manager.save(
                manager.create(Account, {
                    email,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    password,
                    role: AccountRole.PlatformAdmin
                })
            );
        });

        const { emailVerificationToken } = await this.verificationService.issueOneTimePasscode(account);

        const session = await this.completeLogin(account, res);

        this.logger.log(`First platform:admin set up: ${account.id}`, logContext);

        return { ...session, emailVerificationToken };
    }

    /** Creates an account with an argon2-hashed password. The welcome email waits until the email address is
     * verified, so this issues a one-time passcode instead.
     *
     * Deliberately handles its own errors instead of leaving them to the global filters: a duplicate email (23505)
     * becomes a friendly ForbiddenException.
     * @throws ForbiddenException when the passwords differ or the email is taken.
     * @throws InternalServerErrorException for anything unexpected. */
    async register(data: AccountRegisterDTO) {
        const logContext = 'AccountService-register';

        try {
            if (data.password !== data.passwordConfirm) {
                this.logger.warn('Register attempt failed: Passwords do not match.', logContext);
                throw new ForbiddenException('Passwords do not match.');
            }

            const hashedPassword = await argon.hash(data.password);

            const user = this.accountRepository.create({
                ...data,
                email: data.email.toLowerCase(),
                password: hashedPassword
            });

            const savedUser = await this.accountRepository.save(user);

            const { emailVerificationToken } = await this.verificationService.issueOneTimePasscode(savedUser);

            this.logger.debug(`Registration successful for ${savedUser.id}`, logContext);

            return { account: savedUser, emailVerificationToken };
        } catch (error: unknown) {
            if (error instanceof QueryFailedError) {
                this.logger.error(`QueryFailedError during registration: ${error.message}`, error.stack, logContext);

                const driverError = error.driverError as { code?: string };
                if (driverError.code === '23505') {
                    throw new ForbiddenException(
                        'User already exists. Please register with a new email address or reset your password.'
                    );
                }
            }

            if (error instanceof ForbiddenException) {
                this.logger.warn(`ForbiddenException during registration: ${error.message}`, logContext);
                throw error;
            }

            if (error instanceof Error) {
                this.logger.error(`Unexpected error during registration: ${error.message}`, error.stack, logContext);
            } else {
                this.logger.error(
                    `Unexpected error during registration: ${JSON.stringify(error)}`,
                    undefined,
                    logContext
                );
            }

            throw new InternalServerErrorException('An unexpected error occurred during registration.');
        }
    }

    /** The account behind the session cookie, with the organizations it belongs to. The caller is whoever the cookie
     * says, never someone named in the request.
     * @throws ForbiddenException when the account no longer exists. */
    async get(requester: Account) {
        const logContext = 'AccountService-get';

        const account = await this.accountRepository.findOne({
            where: { id: requester.id },
            relations: { organizationList: true }
        });

        if (!account) {
            this.logger.warn(`Get attempt failed: No account found for ID: ${requester.id}`, logContext);
            throw new ForbiddenException('Unable to find account.');
        }

        this.logger.debug(`Successfully retrieved account for ID: ${requester.id}`, logContext);

        return account;
    }

    /** Gives the account `role` only if it has none, so this never changes an existing role, and adds it to
     * `organizationID` when one is given and it doesn't already belong. Used by invitation acceptance and organization
     * creation. */
    async assignRole(accountID: string, role: AccountRole, organizationID?: string) {
        const logContext = 'AccountService-assignRole';

        if (organizationID) {
            const isMember = await this.accountRepository.exists({
                where: { id: accountID, organizationList: { id: organizationID } }
            });

            if (!isMember) {
                await this.accountRepository
                    .createQueryBuilder()
                    .relation(Account, 'organizationList')
                    .of(accountID)
                    .add(organizationID);
            }
        }

        await this.accountRepository.update({ id: accountID, role: IsNull() }, { role });

        this.logger.debug(`Role and membership applied to account ${accountID}`, logContext);
    }

    /** The ID of every account.
     * @throws NotFoundException when there are none. */
    async readAll() {
        const logContext = 'AccountService-readAll';

        const users = await this.accountRepository.find({
            select: {
                id: true
            }
        });

        if (!users || users.length === 0) {
            this.logger.warn('Attempted to read users but none found.', logContext);
            throw new NotFoundException('No users found.');
        }

        this.logger.debug(`Successfully retrieved ${users.length} users.`, logContext);

        return users;
    }

    /** Updates the name on the account making the request. The account comes from the session (`requesterID`), never
     * from the request body, so one account can't change another's name.
     * @throws ForbiddenException when the requester's account no longer exists. */
    async updateAccount(data: AccountUpdateDTO, requesterID: string) {
        const logContext = 'AccountService-updateAccount';

        const account = await this.accountRepository.findOne({
            where: {
                id: requesterID
            }
        });

        if (!account) {
            this.logger.warn(`Update Account attempt failed: No account found for ID: ${requesterID}`, logContext);
            throw new ForbiddenException('Unable to find user.');
        }

        const updatedAccount = await this.accountRepository.preload({
            id: account.id,
            firstName: data.firstName,
            lastName: data.lastName
        });

        const result = await this.accountRepository.save(updatedAccount);

        this.logger.debug(`Account updated successfully for ${account.id}`, logContext);

        return result;
    }
}
