// NPM Modules
import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { LessThan, MoreThan, Repository } from 'typeorm';

// Shared Modules
import MFAMethod from '@mayday-command/utils/enums/MFAMethod.enum';
import isVerified from '@mayday-command/utils/helpers/isVerified';

// Custom Modules
import MFAResendDTO from './dto/resend.dto';
import MFAVerifyDTO from './dto/verify.dto';
import mfaMethodHandlersToken from './mfa-method-handlers.token';
import AuthService from 'src/auth/auth.service';
import Account from 'src/database/account.entity';
import MFAChallenge from 'src/database/mfa-challenge.entity';
import LoggerService from 'src/logger/logger.service';
import OneTimePasscodeService from 'src/otp/one-time-passcode.service';
import TooManyRequestsException from 'src/utils/exceptions/TooManyRequests.exception';
import MFAMethodHandler from 'src/utils/interfaces/MFAMethodHandler.interface';

/** What login returns, instead of a session, when a second factor is due. */
export interface MFAChallengeResponse {
    mfaRequired: true;
    /** Identifies the pending challenge to `/mfa/verify` and `/mfa/resend`. */
    mfaToken: string;
    method: MFAMethod;
    /** Where the code went, masked for display. */
    destination: string;
    resendAvailableAt: Date;
}

/** One hour, the window for the per-account challenge cap. */
const hourMS = 60 * 60 * 1000;

/** The second factor at login: deciding when one is due, issuing and resending challenges, and verifying the code,
 * which is the one place a pending login becomes a real session. Method-agnostic: it only talks to
 * `MFAMethodHandler`s. */
@Injectable()
export default class MFAService {
    /** Challenges an account may be sent per hour, resends included. */
    static readonly challengesPerHour = 5;
    /** How long a passed 2FA check lasts when `MFA_REVALIDATION_DAYS` isn't set to a positive number. */
    static readonly defaultRevalidationDays = 30;

    /** The account and challenge repositories, plus the auth service, the registered method handlers, the logger and
     * the one-time passcode service. */
    constructor(
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        private authService: AuthService,
        @InjectRepository(MFAChallenge)
        private challengeRepository: Repository<MFAChallenge>,
        @Inject(mfaMethodHandlersToken) private handlers: MFAMethodHandler[],
        private logger: LoggerService,
        private oneTimePasscode: OneTimePasscodeService
    ) {}

    /** What login and resend return for a challenge: a fresh encrypted token for it, the method, the masked
     * destination and when resend unlocks. */
    private async buildResponse(
        account: Account,
        handler: MFAMethodHandler,
        challenge: MFAChallenge
    ): Promise<MFAChallengeResponse> {
        const { mfaChallengeToken } = await this.authService.generateTokenMFAChallenge(account.id, challenge.id);

        return {
            mfaRequired: true,
            mfaToken: mfaChallengeToken,
            method: challenge.method,
            destination: handler.getDestination(account),
            resendAvailableAt: this.oneTimePasscode.getResendAvailableAt(challenge.createdOn)
        };
    }

    /** The account a challenge token names. A token for an account that no longer exists is treated like any other
     * invalid token, rather than surfacing a database "not found" error as a 500.
     * @throws ForbiddenException when the account doesn't exist or is deactivated. */
    private async findActiveAccount(id: string): Promise<Account> {
        const account = await this.accountRepository.findOne({ where: { id } });

        if (!account) {
            throw new ForbiddenException('Invalid token.');
        }

        if (!account.isActive) {
            throw new ForbiddenException('Account is deactivated.');
        }

        return account;
    }

    /** Methods this account can use right now. The first is the one a
     * challenge uses; a stored preference will slot in here later. */
    private getAvailableHandlers(account: Account): MFAMethodHandler[] {
        return this.handlers.filter((handler) => isVerified(account, handler.verificationType));
    }

    /** The handler for `method`.
     * @throws BadRequestException when that method is no longer registered. */
    private getHandler(method: MFAMethod): MFAMethodHandler {
        const handler = this.handlers.find((candidate) => candidate.method === method);

        if (!handler) {
            throw new BadRequestException('This login method is no longer available. Please log in again.');
        }

        return handler;
    }

    /** `MFA_REVALIDATION_DAYS` when it's a positive number, otherwise {@link MFAService.defaultRevalidationDays}. */
    private getRevalidationDays(): number {
        const days = Number(process.env.MFA_REVALIDATION_DAYS);

        return Number.isFinite(days) && days > 0 ? days : MFAService.defaultRevalidationDays;
    }

    /** Atomic, so concurrent guesses can't each read the same count and slip
     * past the cap. Returns the post-increment value. */
    private async incrementAttempts(id: string): Promise<number> {
        const result = await this.challengeRepository
            .createQueryBuilder()
            .update(MFAChallenge)
            .set({ attempts: () => '"attempts" + 1' })
            .where('id = :id', { id })
            .returning('"attempts"')
            .execute();

        return (result.raw as Array<{ attempts: number }>)[0].attempts;
    }

    /** Ends a challenge without deleting it, so it still counts toward the
     * per-hour cap. */
    private async invalidate(id: string) {
        await this.challengeRepository.update(id, { expiresAt: new Date() });
    }

    /** Whether logging in must be followed by a second factor: the account has
     * at least one method it can use, and it has been more than
     * `MFA_REVALIDATION_DAYS` since it last passed one (or it never has). An
     * account with no usable method, e.g. one whose email is still unverified,
     * is never challenged; onboarding is what gets it verified. */
    isChallengeRequired(account: Account): boolean {
        if (this.getAvailableHandlers(account).length === 0) {
            return false;
        }

        if (account.lastMFAValidatedAt) {
            const revalidationMS = this.getRevalidationDays() * 24 * hourMS;

            if (Date.now() - new Date(account.lastMFAValidatedAt).getTime() <= revalidationMS) {
                return false;
            }
        }

        return true;
    }

    /** Creates and delivers a new challenge. Resends count here too, so the
     * per-hour cap bounds how many emails anyone holding the password can
     * trigger. */
    private async issueChallenge(account: Account, handler: MFAMethodHandler): Promise<MFAChallengeResponse> {
        const oneHourAgo = new Date(Date.now() - hourMS);

        await this.challengeRepository.delete({ account: { id: account.id }, createdOn: LessThan(oneHourAgo) });

        const issuedRecently = await this.challengeRepository.count({
            where: { account: { id: account.id }, createdOn: MoreThan(oneHourAgo) }
        });

        if (issuedRecently >= MFAService.challengesPerHour) {
            throw new TooManyRequestsException('Too many login codes requested. Please try again later.');
        }

        const { codeHash } = await handler.issue(account);

        const challenge = await this.challengeRepository.save(
            this.challengeRepository.create({
                account,
                codeHash,
                expiresAt: this.oneTimePasscode.getExpiresAt(new Date()),
                method: handler.method
            })
        );

        return this.buildResponse(account, handler, challenge);
    }

    /** Replaces the challenge the token names with a fresh one by the same method, once the resend wait has passed.
     * The old challenge is invalidated but kept, so it still counts toward the hourly cap.
     * @throws TooManyRequestsException before the resend wait is over, or past the hourly cap.
     * @throws ForbiddenException when the token is invalid or the account is deactivated. */
    async resend(data: MFAResendDTO): Promise<MFAChallengeResponse> {
        const decoded = await this.authService.decodeTokenMFAChallenge(data.mfaToken);

        const challenge = await this.challengeRepository.findOne({
            where: { id: decoded.challengeID, account: { id: decoded.sub } }
        });

        if (!challenge) {
            throw new ForbiddenException('Invalid token.');
        }

        const resendAvailableAt = this.oneTimePasscode.getResendAvailableAt(challenge.createdOn);

        if (resendAvailableAt > new Date()) {
            const retryAfterSeconds = Math.ceil((resendAvailableAt.getTime() - Date.now()) / 1000);

            throw new TooManyRequestsException(
                `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
                retryAfterSeconds
            );
        }

        const account = await this.findActiveAccount(decoded.sub);

        await this.invalidate(challenge.id);

        return this.issueChallenge(account, this.getHandler(challenge.method));
    }

    /** Called by login in place of issuing a session. A challenge that is
     * still live is reused rather than replaced, so logging in again can't
     * reset its attempt counter or send another email. */
    async startChallenge(account: Account): Promise<MFAChallengeResponse> {
        const live = await this.challengeRepository.findOne({
            where: { account: { id: account.id }, expiresAt: MoreThan(new Date()) },
            order: { createdOn: 'DESC' }
        });

        if (live) {
            return this.buildResponse(account, this.getHandler(live.method), live);
        }

        return this.issueChallenge(account, this.getAvailableHandlers(account)[0]);
    }

    /** Checks the code and, only if it is right, issues the session cookie.
     * This is the one place a pending login becomes a real one. */
    async verify(data: MFAVerifyDTO, res: Response) {
        const logContext = 'MFAService-verify';

        const decoded = await this.authService.decodeTokenMFAChallenge(data.mfaToken);

        const challenge = await this.challengeRepository.findOne({
            where: { id: decoded.challengeID, account: { id: decoded.sub } },
            select: { id: true, method: true, codeHash: true, expiresAt: true, attempts: true }
        });

        if (!challenge || challenge.expiresAt <= new Date()) {
            throw new BadRequestException('This code has expired. Please request a new one.');
        }

        const attempts = await this.incrementAttempts(challenge.id);

        if (attempts > OneTimePasscodeService.maxAttempts) {
            throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
        }

        const isMatch = await this.getHandler(challenge.method).verify(challenge, data.oneTimePasscode);

        if (!isMatch) {
            this.logger.warn(`Incorrect login code for ${decoded.sub} (attempt ${attempts})`, logContext);

            if (attempts === OneTimePasscodeService.maxAttempts) {
                await this.invalidate(challenge.id);

                throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
            }

            throw new BadRequestException(
                `Incorrect code. ${OneTimePasscodeService.maxAttempts - attempts} attempts remaining.`
            );
        }

        const account = await this.findActiveAccount(decoded.sub);

        await this.challengeRepository.delete({ account: { id: account.id } });

        const signedInAt = new Date();
        await this.accountRepository.update(account.id, { lastLoginAt: signedInAt, lastMFAValidatedAt: signedInAt });

        this.logger.debug(`Login code accepted for ${account.id}`, logContext);

        return this.authService.createCookieLogin(account, res);
    }
}
