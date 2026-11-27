// NPM Modules
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

// Shared Modules
import VerificationProvider from '@mayday-command/utils/enums/VerificationProvider.enum';
import VerificationStatus from '@mayday-command/utils/enums/VerificationStatus.enum';
import VerificationType from '@mayday-command/utils/enums/VerificationType.enum';
import isVerified from '@mayday-command/utils/helpers/isVerified';

// Custom Modules
import VerificationEmailConfirmDTO from './dto/email-confirm.dto';
import VerificationEmailResendDTO from './dto/email-resend.dto';
import AuthService from 'src/auth/auth.service';
import Account from 'src/database/account.entity';
import LoggerService from 'src/logger/logger.service';
import OneTimePasscodeService from 'src/otp/one-time-passcode.service';
import TooManyRequestsException from 'src/utils/exceptions/TooManyRequests.exception';
/** What a client needs after a code is issued: the token that identifies the
 * account to the public confirm/resend routes, and when resend unlocks. */
export interface EmailVerificationChallenge {
    emailVerificationToken: string;
    resendAvailableAt: Date;
}

/** Email verification: issuing a six-digit code, resending it, and confirming it, which marks the account's email
 * verified. Uses `OneTimePasscodeService` for the code itself; the code is stored on the account. */
@Injectable()
export default class VerificationService {
    /** The account repository, plus the auth service, the 'email' queue, the logger and the one-time passcode
     * service. */
    constructor(
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        private authService: AuthService,
        @InjectQueue('email') private emailQueue: Queue,
        private logger: LoggerService,
        private oneTimePasscode: OneTimePasscodeService
    ) {}

    /** @throws BadRequestException when the account's email is already verified. */
    private assertNotVerified(account: Account) {
        if (isVerified(account, VerificationType.Email)) {
            throw new BadRequestException('Your email address has already been verified.');
        }
    }

    /** Checks `data.oneTimePasscode` against the account the token names and, when it matches, marks the email
     * verified and queues the welcome email. Attempts are counted atomically; the 5th wrong code clears the code, so a
     * new one must be requested. Proving control of the mailbox just now also counts as a fresh 2FA validation.
     * @throws BadRequestException when the code has expired, is wrong, or has run out of attempts.
     * @throws ForbiddenException when the token is invalid or the account is deactivated. */
    async emailConfirm(data: VerificationEmailConfirmDTO) {
        const logContext = 'VerificationService-emailConfirm';

        const decoded = await this.authService.decodeTokenEmailVerify(data.emailVerificationToken);

        const account = await this.findAccountFromToken(decoded.sub, decoded.email);
        this.assertNotVerified(account);

        const challenge = await this.findChallenge(account.id);

        if (
            !challenge.oneTimePasscode ||
            !challenge.oneTimePasscodeExpiration ||
            challenge.oneTimePasscodeExpiration <= new Date()
        ) {
            throw new BadRequestException('This code has expired. Please request a new one.');
        }

        const attempts = await this.incrementAttempts(account.id);

        if (attempts > OneTimePasscodeService.maxAttempts) {
            throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
        }

        const isMatch = await this.oneTimePasscode.matches(challenge.oneTimePasscode, data.oneTimePasscode);

        if (!isMatch) {
            this.logger.warn(`Incorrect verification code for ${account.id} (attempt ${attempts})`, logContext);

            if (attempts === OneTimePasscodeService.maxAttempts) {
                await this.accountRepository.update(account.id, {
                    oneTimePasscode: null,
                    oneTimePasscodeExpiration: null
                });

                throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
            }

            throw new BadRequestException(
                `Incorrect code. ${OneTimePasscodeService.maxAttempts - attempts} attempts remaining.`
            );
        }

        await this.accountRepository.update(account.id, {
            verifications: {
                ...account.verifications,
                email: {
                    provider: VerificationProvider.OTP,
                    status: VerificationStatus.Verified,
                    verifiedOn: new Date()
                }
            },
            oneTimePasscode: null,
            oneTimePasscodeExpiration: null,
            oneTimePasscodeAttempts: 0,
            lastMFAValidatedAt: new Date()
        });

        await this.emailQueue.add('welcome-email', {
            firstName: account.firstName,
            lastName: account.lastName,
            email: account.email
        });

        this.logger.debug(`Email verified for ${account.id}`, logContext);

        return { message: 'Your email address has been verified.' };
    }

    /** Used by the logged-in Portal flow. Issues a code only when none is
     * live, so reloading the Portal never rotates a code that is already
     * sitting in the user's inbox. */
    async emailRequest(account: Account): Promise<EmailVerificationChallenge> {
        const logContext = 'VerificationService-emailRequest';

        this.assertNotVerified(account);

        const challenge = await this.findChallenge(account.id);

        if (challenge.oneTimePasscodeExpiration && challenge.oneTimePasscodeExpiration > new Date()) {
            this.logger.debug(`Verification code already live for ${account.id}, not re-sending`, logContext);

            const { emailVerificationToken } = await this.authService.generateTokenEmailVerify(
                account.id,
                account.email
            );

            return {
                emailVerificationToken,
                resendAvailableAt: this.getResendAvailableAt(challenge.oneTimePasscodeExpiration)
            };
        }

        return this.issueOneTimePasscode(account);
    }

    /** Used by the public verify page, which has only the token from the
     * email link or the register response. Accepts an expired token so a
     * user whose link has lapsed can still request a fresh one. */
    async emailResend(data: VerificationEmailResendDTO): Promise<EmailVerificationChallenge> {
        const decoded = await this.authService.decodeTokenEmailVerify(data.emailVerificationToken, true);

        const account = await this.findAccountFromToken(decoded.sub, decoded.email);
        this.assertNotVerified(account);

        const challenge = await this.findChallenge(account.id);

        if (challenge.oneTimePasscodeExpiration) {
            const resendAvailableAt = this.getResendAvailableAt(challenge.oneTimePasscodeExpiration);

            if (resendAvailableAt > new Date()) {
                const retryAfterSeconds = Math.ceil((resendAvailableAt.getTime() - Date.now()) / 1000);

                throw new TooManyRequestsException(
                    `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
                    retryAfterSeconds
                );
            }
        }

        return this.issueOneTimePasscode(account);
    }

    /** The account a verification token names, matched on both its ID and the email the code was sent to. A
     * deactivated account is refused, the same as at login, password reset and 2FA, so it can't trigger verification
     * emails or complete verification.
     * @throws ForbiddenException when no account matches, or the account is deactivated. */
    private async findAccountFromToken(id: string, email: string) {
        const logContext = 'VerificationService-findAccountFromToken';

        const account = await this.accountRepository.findOne({ where: { id, email } });

        if (!account) {
            throw new ForbiddenException('Invalid token.');
        }

        if (!account.isActive) {
            this.logger.warn(`Verification refused for ${account.id}: Account is deactivated.`, logContext);
            throw new ForbiddenException('Account is deactivated.');
        }

        return account;
    }

    /** The challenge columns are `select: false`, so they have to be asked
     * for by name. */
    private async findChallenge(id: string) {
        return this.accountRepository.findOneOrFail({
            where: { id },
            select: { id: true, oneTimePasscode: true, oneTimePasscodeExpiration: true }
        });
    }

    /** When another code may be requested, worked out from the stored expiry, since only the expiry is stored. */
    private getResendAvailableAt(oneTimePasscodeExpiration: Date) {
        return this.oneTimePasscode.getResendAvailableAt(this.oneTimePasscode.getIssuedAt(oneTimePasscodeExpiration));
    }

    /** Atomic, so concurrent guesses can't each read the same count and slip
     * past the cap. Returns the post-increment value. */
    private async incrementAttempts(id: string): Promise<number> {
        const result = await this.accountRepository
            .createQueryBuilder()
            .update(Account)
            .set({ oneTimePasscodeAttempts: () => '"oneTimePasscodeAttempts" + 1' })
            .where('id = :id', { id })
            .returning('"oneTimePasscodeAttempts"')
            .execute();

        return (result.raw as Array<{ oneTimePasscodeAttempts: number }>)[0].oneTimePasscodeAttempts;
    }

    /** Generates and stores a fresh code, then queues the email carrying it
     * and the link. Public because `AccountService.register` calls it to send
     * the first verification email. */
    async issueOneTimePasscode(account: Account): Promise<EmailVerificationChallenge> {
        const logContext = 'VerificationService-issueOneTimePasscode';

        const oneTimePasscode = this.oneTimePasscode.generate();
        const oneTimePasscodeExpiration = this.oneTimePasscode.getExpiresAt(new Date());

        await this.accountRepository.update(account.id, {
            oneTimePasscode: await this.oneTimePasscode.hash(oneTimePasscode),
            oneTimePasscodeExpiration,
            oneTimePasscodeAttempts: 0
        });

        const { emailVerificationToken } = await this.authService.generateTokenEmailVerify(account.id, account.email);

        await this.emailQueue.add('email-verification', {
            firstName: account.firstName,
            lastName: account.lastName,
            email: account.email,
            token: emailVerificationToken,
            oneTimePasscode
        });

        this.logger.debug(`Verification email queued for ${account.id}`, logContext);

        return {
            emailVerificationToken,
            resendAvailableAt: this.getResendAvailableAt(oneTimePasscodeExpiration)
        };
    }
}
