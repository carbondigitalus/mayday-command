// NPM Modules
import {
    ForbiddenException,
    HttpException,
    HttpStatus,
    Injectable,
    InternalServerErrorException,
    NotFoundException
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon from 'argon2';
import { Queue } from 'bullmq';
import { Request, Response } from 'express';
import { FindOptionsWhere, QueryFailedError, Raw, Repository } from 'typeorm';

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
import VerificationService from 'src/verification/verification.service';

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
                isActive: true
            },
            skip: (page - 1) * limit,
            take: limit
        });

        this.logger.debug(`Admin search returned ${data.length} of ${total} account(s).`, logContext);

        return { data, total, page, limit };
    }

    /** Full account detail lookup by id, for the platform:admin
     * account-administration UI. */
    async adminFindOne(accountID: string) {
        const logContext = 'AccountService-adminFindOne';

        const user = await this.accountRepository.findOne({ where: { id: accountID } });

        if (!user) {
            this.logger.warn(`Attempt to view non-existent account: ${accountID}`, logContext);
            throw new NotFoundException('Account not found.');
        }

        this.logger.debug(`Successfully retrieved account: ${accountID}`, logContext);

        return user;
    }

    /** Checks the email and password and returns a session, or a second-factor challenge when 2FA has lapsed.
     *
     * Checks run in this order, each refusing before the more expensive one after it: a locked account is refused
     * before any hashing, so a guesser gains nothing by retrying and we spend nothing checking. The attempt is
     * reserved before the password is compared, so parallel guesses can't all read the same count.
     *
     * @throws ForbiddenException with the generic "Email or password incorrect." for an unknown email or wrong
     * password, or "Account is deactivated.".
     * @throws HttpException 429 when the account is locked, or this attempt reached {@link AccountService.maxPasswordAttempts}. */
    async login(data: AccountLoginDTO, req: Request, res: Response) {
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
            this.logger.warn(`Login attempt with non-existent email: ${data.email}`, logContext);
            throw new ForbiddenException('Email or password incorrect.');
        }

        if (account.loginLockedUntil && account.loginLockedUntil.getTime() > Date.now()) {
            this.logger.warn(`Login refused for ${data.email}: Locked after too many attempts.`, logContext);
            throw this.lockedException(account.loginLockedUntil);
        }

        const attempts = await this.reservePasswordAttempt(account.id, 'loginAttempts');

        const passwordValidateSuccess = await argon.verify(account.password, data.password);

        if (!passwordValidateSuccess) {
            this.logger.warn(`Login attempt for email ${data.email} failed due to incorrect password.`, logContext);

            if (attempts >= AccountService.maxPasswordAttempts) {
                const lockedUntil = new Date(Date.now() + AccountService.lockoutMS);

                await this.accountRepository.update(account.id, { loginAttempts: 0, loginLockedUntil: lockedUntil });
                throw this.lockedException(lockedUntil);
            }

            throw new ForbiddenException('Email or password incorrect.');
        }

        await this.accountRepository.update(account.id, { loginAttempts: 0, loginLockedUntil: null });

        if (!account.isActive) {
            this.logger.warn(`Login attempt for deactivated account: ${data.email}`, logContext);
            throw new ForbiddenException('Account is deactivated.');
        }

        const session = await this.completeLogin(account, req, res);

        this.logger.debug(`Login successful for ${data.email}`, logContext);

        return session;
    }

    /** The one place a verified password becomes a session. When 2FA has
     * lapsed it returns a challenge and issues no cookie, so nothing that
     * reads the session cookie ever sees an account that skipped it. A session
     * issued here records `lastLoginAt`; after a challenge, MFA verification does. */
    private async completeLogin(account: Account, req: Request, res: Response) {
        if (await this.mfaService.isChallengeRequired(account)) {
            return this.mfaService.startChallenge(account);
        }

        await this.accountRepository.update(account.id, { lastLoginAt: new Date() });

        return this.authService.createCookieLogin(account, req, res);
    }

    /** Clears the session cookie. */
    logout(req: Request, res: Response) {
        const logContext = 'AccountService-logout';

        const result = this.authService.createCookieLogout(req, res);

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
     * @throws HttpException 429 when locked. */
    async passwordChange(accountID: string, data: AccountPasswordChangeDTO, req: Request, res: Response) {
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
            this.logger.warn(
                `Password change refused for ${account.email}: Locked after too many attempts.`,
                logContext
            );
            throw this.lockedException(account.passwordChangeLockedUntil);
        }

        const attempts = await this.reservePasswordAttempt(account.id, 'passwordChangeAttempts');

        if (!(await argon.verify(account.password, data.currentPassword))) {
            this.logger.warn(`Password change failed for ${account.email}: Current password is incorrect.`, logContext);

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
            this.logger.warn(`Password change failed for ${account.email}: Passwords do not match.`, logContext);
            throw new ForbiddenException('Passwords do not match.');
        }

        if (data.password === data.currentPassword) {
            this.logger.warn(
                `Password change failed for ${account.email}: New password matches the current one.`,
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
        this.logger.debug(`Password updated successfully for ${account.email}`, logContext);

        return this.authService.createCookieLogin(account, req, res);
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

        return new HttpException(
            {
                statusCode: HttpStatus.TOO_MANY_REQUESTS,
                message: `Too many incorrect passwords. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
                retryAfterSeconds
            },
            HttpStatus.TOO_MANY_REQUESTS
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
            this.logger.warn(`Password reset requested for non-existent email: ${data.email}`, logContext);
            return { message: passwordForgotMessage };
        }

        const token = await this.authService.generateTokenPasswordReset(account.id, account.email);

        const updatedAccount = await this.accountRepository.preload({
            id: account.id,
            passwordResetToken: token.passwordResetToken,
            passwordResetExpires: token.passwordResetExpires
        });

        await this.accountRepository.save(updatedAccount);

        await this.emailQueue.add('password-reset-init', {
            firstName: updatedAccount.firstName,
            lastName: updatedAccount.lastName,
            email: updatedAccount.email,
            token: token.passwordResetToken
        });
        this.logger.debug(`Password reset token generated and email sent for ${data.email}`, logContext);

        return { message: passwordForgotMessage };
    }

    /** Sets a new password from the emailed reset token in `data.token` and signs the user in. A deactivated account
     * is refused before anything changes, the same as at login. A successful reset also clears any login lockout, since
     * the new password was set through the account's own email.
     * @throws ForbiddenException when the token is unknown or expired, the account is deactivated, or the passwords
     * differ. */
    async passwordReset(data: AccountPasswordResetDTO, req: Request, res: Response) {
        const logContext = 'AccountService-passwordReset';

        const user = await this.accountRepository.findOne({
            where: { passwordResetToken: data.token }
        });

        if (!user) {
            this.logger.warn('Password reset attempt failed: No account found for the submitted token.', logContext);
            throw new ForbiddenException('Unable to find user.');
        }

        if (!user.isActive) {
            this.logger.warn(`Password reset refused for ${user.email}: Account is deactivated.`, logContext);
            throw new ForbiddenException('Account is deactivated.');
        }

        if (data.password !== data.passwordConfirm) {
            this.logger.warn(`Password reset attempt for ${user.email} failed: Passwords do not match.`, logContext);
            throw new ForbiddenException('Passwords do not match.');
        }

        if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
            this.logger.warn(`Password reset token expired for ${user.email}`, logContext);
            throw new ForbiddenException('Token has expired. Try forgot password again.');
        }

        const hashedPassword = await argon.hash(data.password);

        const updatedUser = await this.accountRepository.preload({
            id: user.id,
            password: hashedPassword,
            passwordChangedAt: new Date(),
            passwordResetToken: null,
            passwordResetExpires: null,
            loginAttempts: 0,
            loginLockedUntil: null
        });

        await this.accountRepository.save(updatedUser);

        await this.emailQueue.add('password-reset-done', {
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email
        });
        this.logger.debug(`Password reset successful for ${user.email}`, logContext);

        return this.completeLogin(user, req, res);
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
                this.logger.warn(`Register attempt for user ${data.email} failed: Passwords do not match.`, logContext);
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

            this.logger.debug(`Registration successful for ${data.email}`, logContext);

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
                this.logger.warn(
                    `ForbiddenException during registration for ${data.email}: ${error.message}`,
                    logContext
                );
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

    /** The account behind the session cookie, with its grants. The caller is whoever the cookie says, never someone
     * named in the request.
     * @throws ForbiddenException when the account no longer exists. */
    async get(requester: Account) {
        const logContext = 'AccountService-get';

        const user = await this.accountRepository.findOne({
            where: { id: requester.id },
            relations: {
                accessList: { organization: true, role: { module: true } }
            }
        });

        if (!user) {
            this.logger.warn(`Get attempt failed: No user found for ID: ${requester.id}`, logContext);
            throw new ForbiddenException('Unable to find user.');
        }

        this.logger.debug(`Successfully retrieved account for ID: ${requester.id}`, logContext);

        return user;
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

        this.logger.debug(`Account updated successfully for ${account.email}`, logContext);

        return result;
    }
}
