// NPM Modules
import { BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

// Custom Modules
import AuthService from 'src/auth/auth.service';
import Account from 'src/database/account.entity';
import MFAChallenge from 'src/database/mfa-challenge.entity';
import LoggerService from 'src/logger/logger.service';
import mfaMethodHandlersToken from 'src/mfa/mfa-method-handlers.token';
import MFAService from 'src/mfa/mfa.service';
import OneTimePasscodeService from 'src/otp/one-time-passcode.service';
import MFAMethod from '@mayday-command/utils/enums/MFAMethod.enum';
import VerificationType from '@mayday-command/utils/enums/VerificationType.enum';

describe('MFAService', () => {
    let service: MFAService;
    let accountRepository: { findOne: jest.Mock; update: jest.Mock };
    let challengeRepository: {
        count: jest.Mock;
        create: jest.Mock;
        createQueryBuilder: jest.Mock;
        delete: jest.Mock;
        findOne: jest.Mock;
        save: jest.Mock;
        update: jest.Mock;
    };
    let builder: Record<string, jest.Mock>;
    let execute: jest.Mock;
    let authService: {
        createCookieLogin: jest.Mock;
        decodeTokenMFAChallenge: jest.Mock;
        generateTokenMFAChallenge: jest.Mock;
    };
    let handler: {
        getDestination: jest.Mock;
        issue: jest.Mock;
        method: MFAMethod;
        verificationType: VerificationType;
        verify: jest.Mock;
    };
    let logger: { debug: jest.Mock; warn: jest.Mock };

    const res = {} as any;
    const originalEnv = { ...process.env };

    const verifiedAccount = (overrides: Record<string, unknown> = {}): any => ({
        id: 'acc-1',
        email: 'a@b.com',
        isActive: true,
        lastMFAValidatedAt: null,
        verifications: { email: { provider: 'otp', status: 'verified' } },
        ...overrides
    });

    const daysAgo = (days: number, extraMS = 0) => new Date(Date.now() - days * 24 * 60 * 60 * 1000 - extraMS);

    const futureDate = () => new Date(Date.now() + 5 * 60 * 1000);

    /** Runs `action` and returns the HttpException it throws. */
    const catchHttp = async (action: () => Promise<unknown>) => {
        const error = await action().catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(HttpException);

        return error as HttpException;
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        delete process.env.MFA_REVALIDATION_DAYS;

        execute = jest.fn().mockResolvedValue({});
        builder = {};
        for (const method of ['update', 'set', 'where', 'returning']) {
            builder[method] = jest.fn().mockReturnValue(builder);
        }
        builder.execute = execute;

        accountRepository = { findOne: jest.fn(), update: jest.fn() };
        challengeRepository = {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn((value) => value),
            createQueryBuilder: jest.fn().mockReturnValue(builder),
            delete: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(async (value) => ({ ...value, id: 'challenge-1', createdOn: new Date() })),
            update: jest.fn()
        };
        authService = {
            createCookieLogin: jest.fn().mockResolvedValue({ status: 'success' }),
            decodeTokenMFAChallenge: jest.fn().mockResolvedValue({ sub: 'acc-1', challengeID: 'challenge-1' }),
            generateTokenMFAChallenge: jest.fn().mockResolvedValue({ mfaChallengeToken: 'mfa-token' })
        };
        handler = {
            getDestination: jest.fn().mockReturnValue('a***@b.com'),
            issue: jest.fn().mockResolvedValue({ codeHash: 'code-hash' }),
            method: MFAMethod.Email,
            verificationType: VerificationType.Email,
            verify: jest.fn()
        };
        logger = { debug: jest.fn(), warn: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MFAService,
                OneTimePasscodeService,
                { provide: getRepositoryToken(Account), useValue: accountRepository },
                { provide: getRepositoryToken(MFAChallenge), useValue: challengeRepository },
                { provide: AuthService, useValue: authService },
                { provide: LoggerService, useValue: logger },
                { provide: mfaMethodHandlersToken, useValue: [handler] }
            ]
        }).compile();

        service = module.get(MFAService);
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('isChallengeRequired', () => {
        it('never challenges an account with no verified method, e.g. an unverified email', async () => {
            expect(service.isChallengeRequired(verifiedAccount({ verifications: null }))).toBe(false);
            expect(
                service.isChallengeRequired(
                    verifiedAccount({ verifications: { email: { provider: 'otp', status: 'pending' } } })
                )
            ).toBe(false);
        });

        it('challenges an account that has never passed 2FA', async () => {
            expect(service.isChallengeRequired(verifiedAccount())).toBe(true);
        });

        it('lets an account through while its last validation is inside 30 days', async () => {
            expect(service.isChallengeRequired(verifiedAccount({ lastMFAValidatedAt: daysAgo(29) }))).toBe(false);
        });

        it('challenges once it is more than 30 days old', async () => {
            expect(service.isChallengeRequired(verifiedAccount({ lastMFAValidatedAt: daysAgo(31) }))).toBe(true);
        });

        it('treats the 30-day mark as the boundary', async () => {
            expect(service.isChallengeRequired(verifiedAccount({ lastMFAValidatedAt: daysAgo(30, -5000) }))).toBe(
                false
            );
            expect(service.isChallengeRequired(verifiedAccount({ lastMFAValidatedAt: daysAgo(30, 5000) }))).toBe(true);
        });

        it('accepts the timestamp as an ISO string, the way it comes back from some drivers', async () => {
            expect(service.isChallengeRequired(verifiedAccount({ lastMFAValidatedAt: daysAgo(1).toISOString() }))).toBe(
                false
            );
        });

        it('honours MFA_REVALIDATION_DAYS', async () => {
            process.env.MFA_REVALIDATION_DAYS = '7';

            expect(service.isChallengeRequired(verifiedAccount({ lastMFAValidatedAt: daysAgo(8) }))).toBe(true);
            expect(service.isChallengeRequired(verifiedAccount({ lastMFAValidatedAt: daysAgo(6) }))).toBe(false);
        });

        it.each(['', 'abc', '0', '-3'])('falls back to 30 days when MFA_REVALIDATION_DAYS is "%s"', async (value) => {
            process.env.MFA_REVALIDATION_DAYS = value;

            expect(service.isChallengeRequired(verifiedAccount({ lastMFAValidatedAt: daysAgo(29) }))).toBe(false);
            expect(service.isChallengeRequired(verifiedAccount({ lastMFAValidatedAt: daysAgo(31) }))).toBe(true);
        });
    });

    describe('startChallenge', () => {
        it('issues a challenge, stores only the hash, and returns the token without any session', async () => {
            const account = verifiedAccount();
            challengeRepository.findOne.mockResolvedValue(null);

            const result = await service.startChallenge(account);

            expect(handler.issue).toHaveBeenCalledWith(account);
            expect(challengeRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    account,
                    codeHash: 'code-hash',
                    expiresAt: expect.any(Date),
                    method: MFAMethod.Email
                })
            );
            expect(authService.generateTokenMFAChallenge).toHaveBeenCalledWith('acc-1', 'challenge-1');
            expect(result).toEqual({
                mfaRequired: true,
                mfaToken: 'mfa-token',
                method: MFAMethod.Email,
                destination: 'a***@b.com',
                resendAvailableAt: expect.any(Date)
            });
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
        });

        it('expires the code ten minutes out and opens the resend window after one', async () => {
            challengeRepository.findOne.mockResolvedValue(null);
            const before = Date.now();

            const result = await service.startChallenge(verifiedAccount());

            const saved = challengeRepository.save.mock.calls[0][0];
            expect(saved.expiresAt.getTime() - before).toBeGreaterThanOrEqual(OneTimePasscodeService.lifetimeMS);
            expect(saved.expiresAt.getTime() - before).toBeLessThan(OneTimePasscodeService.lifetimeMS + 5000);
            expect(result.resendAvailableAt.getTime() - before).toBeGreaterThanOrEqual(
                OneTimePasscodeService.resendCooldownMS
            );
        });

        it('reuses a live challenge instead of sending another email or resetting its attempts', async () => {
            const live = { id: 'live-1', method: MFAMethod.Email, createdOn: new Date(Date.now() - 20_000) };
            challengeRepository.findOne.mockResolvedValue(live);

            const result = await service.startChallenge(verifiedAccount());

            expect(handler.issue).not.toHaveBeenCalled();
            expect(challengeRepository.save).not.toHaveBeenCalled();
            expect(authService.generateTokenMFAChallenge).toHaveBeenCalledWith('acc-1', 'live-1');
            expect(result.mfaToken).toBe('mfa-token');
            expect(result.resendAvailableAt.getTime()).toBe(live.createdOn.getTime() + 60_000);
        });

        it('stops after five challenges in an hour (429) without sending anything', async () => {
            challengeRepository.findOne.mockResolvedValue(null);
            challengeRepository.count.mockResolvedValue(MFAService.challengesPerHour);

            const error = await catchHttp(() => service.startChallenge(verifiedAccount()));

            expect(error.getStatus()).toBe(429);
            expect(handler.issue).not.toHaveBeenCalled();
            expect(challengeRepository.save).not.toHaveBeenCalled();
        });

        it('allows a challenge when fewer than five were issued in the hour', async () => {
            challengeRepository.findOne.mockResolvedValue(null);
            challengeRepository.count.mockResolvedValue(MFAService.challengesPerHour - 1);

            await expect(service.startChallenge(verifiedAccount())).resolves.toMatchObject({ mfaRequired: true });
        });

        it('clears out challenges older than an hour first', async () => {
            challengeRepository.findOne.mockResolvedValue(null);

            await service.startChallenge(verifiedAccount());

            expect(challengeRepository.delete).toHaveBeenCalledWith({
                account: { id: 'acc-1' },
                createdOn: expect.objectContaining({ type: 'lessThan', value: expect.any(Date) })
            });
        });

        it('fails clearly when a stored challenge names a method that is no longer registered', async () => {
            challengeRepository.findOne.mockResolvedValue({ id: 'live-1', method: 'carrier-pigeon' });

            await expect(service.startChallenge(verifiedAccount())).rejects.toThrow(BadRequestException);
        });
    });

    describe('resend', () => {
        const data = { mfaToken: 'old-token' };
        const oldChallenge = () => ({
            id: 'challenge-1',
            method: MFAMethod.Email,
            createdOn: new Date(Date.now() - 2 * 60 * 1000)
        });

        beforeEach(() => {
            accountRepository.findOne.mockResolvedValue(verifiedAccount());
        });

        it('passes on an invalid or expired token without touching anything', async () => {
            authService.decodeTokenMFAChallenge.mockRejectedValue(new ForbiddenException('Invalid token.'));

            await expect(service.resend(data)).rejects.toThrow(ForbiddenException);
            expect(handler.issue).not.toHaveBeenCalled();
        });

        it('rejects a token whose challenge does not exist for that account', async () => {
            challengeRepository.findOne.mockResolvedValue(null);

            await expect(service.resend(data)).rejects.toThrow(ForbiddenException);
            expect(challengeRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'challenge-1', account: { id: 'acc-1' } }
            });
        });

        it('answers 429 with retryAfterSeconds inside the cooldown and sends nothing', async () => {
            challengeRepository.findOne.mockResolvedValue({
                ...oldChallenge(),
                createdOn: new Date(Date.now() - 10_000)
            });

            const error = await catchHttp(() => service.resend(data));

            expect(error.getStatus()).toBe(429);
            expect(error.getResponse()).toEqual(
                expect.objectContaining({ retryAfterSeconds: expect.any(Number), statusCode: 429 })
            );
            expect(handler.issue).not.toHaveBeenCalled();
            expect(challengeRepository.update).not.toHaveBeenCalled();
        });

        it('after the cooldown, ends the old challenge and issues a fresh one with a new token', async () => {
            challengeRepository.findOne.mockResolvedValue(oldChallenge());

            const result = await service.resend(data);

            expect(challengeRepository.update).toHaveBeenCalledWith('challenge-1', { expiresAt: expect.any(Date) });
            expect(handler.issue).toHaveBeenCalledTimes(1);
            expect(result.mfaToken).toBe('mfa-token');
        });

        it('counts a resend toward the hourly cap', async () => {
            challengeRepository.findOne.mockResolvedValue(oldChallenge());
            challengeRepository.count.mockResolvedValue(MFAService.challengesPerHour);

            const error = await catchHttp(() => service.resend(data));

            expect(error.getStatus()).toBe(429);
            expect(handler.issue).not.toHaveBeenCalled();
        });

        it('refuses a deactivated account', async () => {
            challengeRepository.findOne.mockResolvedValue(oldChallenge());
            accountRepository.findOne.mockResolvedValue(verifiedAccount({ isActive: false }));

            await expect(service.resend(data)).rejects.toThrow(new ForbiddenException('Account is deactivated.'));
            expect(handler.issue).not.toHaveBeenCalled();
        });
    });

    describe('verify', () => {
        const data = { mfaToken: 'mfa-token', oneTimePasscode: '123456' };
        const liveChallenge = (overrides: Record<string, unknown> = {}) => ({
            id: 'challenge-1',
            method: MFAMethod.Email,
            codeHash: 'code-hash',
            expiresAt: futureDate(),
            attempts: 0,
            ...overrides
        });

        beforeEach(() => {
            challengeRepository.findOne.mockResolvedValue(liveChallenge());
            accountRepository.findOne.mockResolvedValue(verifiedAccount());
            execute.mockResolvedValueOnce({ raw: [{ attempts: 1 }] });
            handler.verify.mockResolvedValue(true);
        });

        it('rejects a bad token before looking anything up', async () => {
            authService.decodeTokenMFAChallenge.mockRejectedValue(new ForbiddenException('Invalid token.'));

            await expect(service.verify(data, res)).rejects.toThrow(ForbiddenException);
            expect(challengeRepository.findOne).not.toHaveBeenCalled();
        });

        it('looks the challenge up by id and account, asking for its hash by name', async () => {
            await service.verify(data, res);

            expect(challengeRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'challenge-1', account: { id: 'acc-1' } },
                select: { id: true, method: true, codeHash: true, expiresAt: true, attempts: true }
            });
        });

        it('says the code expired when there is no such challenge', async () => {
            challengeRepository.findOne.mockResolvedValue(null);

            await expect(service.verify(data, res)).rejects.toThrow('This code has expired.');
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
        });

        it('says the code expired once its time is up, without counting an attempt', async () => {
            challengeRepository.findOne.mockResolvedValue(liveChallenge({ expiresAt: new Date(Date.now() - 1000) }));

            await expect(service.verify(data, res)).rejects.toThrow('This code has expired.');
            expect(execute).not.toHaveBeenCalled();
        });

        it('refuses without comparing once attempts are past the cap', async () => {
            execute.mockReset();
            execute.mockResolvedValueOnce({ raw: [{ attempts: OneTimePasscodeService.maxAttempts + 1 }] });

            await expect(service.verify(data, res)).rejects.toThrow('Too many incorrect attempts.');
            expect(handler.verify).not.toHaveBeenCalled();
        });

        it('counts down the remaining attempts on a wrong code and issues no session', async () => {
            handler.verify.mockResolvedValue(false);
            execute.mockReset();
            execute.mockResolvedValueOnce({ raw: [{ attempts: 2 }] });

            await expect(service.verify(data, res)).rejects.toThrow('Incorrect code. 3 attempts remaining.');
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
            expect(challengeRepository.update).not.toHaveBeenCalled();
        });

        it('ends the challenge on the final wrong attempt', async () => {
            handler.verify.mockResolvedValue(false);
            execute.mockReset();
            execute.mockResolvedValueOnce({ raw: [{ attempts: OneTimePasscodeService.maxAttempts }] });

            await expect(service.verify(data, res)).rejects.toThrow('Too many incorrect attempts.');
            expect(challengeRepository.update).toHaveBeenCalledWith('challenge-1', { expiresAt: expect.any(Date) });
        });

        it('still accepts the right code on the final attempt', async () => {
            execute.mockReset();
            execute.mockResolvedValueOnce({ raw: [{ attempts: OneTimePasscodeService.maxAttempts }] });

            await expect(service.verify(data, res)).resolves.toEqual({ status: 'success' });
        });

        it('on the right code: clears the account challenges, stamps the 30-day clock, and only then issues the cookie', async () => {
            const result = await service.verify(data, res);

            expect(handler.verify).toHaveBeenCalledWith(expect.objectContaining({ id: 'challenge-1' }), '123456');
            expect(challengeRepository.delete).toHaveBeenCalledWith({ account: { id: 'acc-1' } });
            expect(accountRepository.update).toHaveBeenCalledWith('acc-1', {
                lastLoginAt: expect.any(Date),
                lastMFAValidatedAt: expect.any(Date)
            });
            const [, stamped] = accountRepository.update.mock.calls[0];
            expect(stamped.lastLoginAt).toBe(stamped.lastMFAValidatedAt);
            expect(authService.createCookieLogin).toHaveBeenCalledWith(expect.objectContaining({ id: 'acc-1' }), res);
            expect(result).toEqual({ status: 'success' });
            expect(execute).toHaveBeenCalledTimes(1);
        });

        it('treats a token for an account that no longer exists as invalid (403), not a 500', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.verify(data, res)).rejects.toThrow(new ForbiddenException('Invalid token.'));
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
            expect(accountRepository.update).not.toHaveBeenCalled();
        });

        it('refuses a deactivated account even with the right code, issuing no session and no stamp', async () => {
            accountRepository.findOne.mockResolvedValue(verifiedAccount({ isActive: false }));

            await expect(service.verify(data, res)).rejects.toThrow(new ForbiddenException('Account is deactivated.'));
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
            expect(accountRepository.update).not.toHaveBeenCalled();
        });
    });
});
