// NPM Modules
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as argon from 'argon2';

// Custom Modules
import AuthService from 'src/auth/auth.service';
import Account from 'src/database/account.entity';
import LoggerService from 'src/logger/logger.service';
import OneTimePasscodeService from 'src/otp/one-time-passcode.service';
import VerificationService from 'src/verification/verification.service';
import VerificationProvider from '@mayday-command/utils/enums/VerificationProvider.enum';
import VerificationStatus from '@mayday-command/utils/enums/VerificationStatus.enum';

jest.mock('argon2');

const mockedArgon = argon as jest.Mocked<typeof argon>;

describe('VerificationService', () => {
    let service: VerificationService;
    let accountRepository: {
        createQueryBuilder: jest.Mock;
        findOne: jest.Mock;
        findOneOrFail: jest.Mock;
        update: jest.Mock;
    };
    let authService: { decodeTokenEmailVerify: jest.Mock; generateTokenEmailVerify: jest.Mock };
    let emailQueue: { add: jest.Mock };
    let logger: { debug: jest.Mock; warn: jest.Mock };
    let execute: jest.Mock;

    const account = {
        id: 'acc-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        isActive: true,
        verifications: { phone: { provider: VerificationProvider.OTP, status: VerificationStatus.Verified } }
    } as unknown as Account;

    const future = () => new Date(Date.now() + 5 * 60 * 1000);
    const past = () => new Date(Date.now() - 1000);

    /** A code issued `ageMs` ago, i.e. expiring 10 minutes after that. */
    const issuedAgo = (ageMs: number) => new Date(Date.now() - ageMs + OneTimePasscodeService.lifetimeMS);

    const confirmData = { emailVerificationToken: 'token', oneTimePasscode: '123456' };

    beforeEach(async () => {
        jest.clearAllMocks();

        execute = jest.fn();
        const builder: Record<string, jest.Mock> = {};
        for (const method of ['update', 'set', 'where', 'returning']) {
            builder[method] = jest.fn().mockReturnValue(builder);
        }
        builder.execute = execute;

        accountRepository = {
            createQueryBuilder: jest.fn().mockReturnValue(builder),
            findOne: jest.fn(),
            findOneOrFail: jest.fn(),
            update: jest.fn()
        };
        authService = {
            decodeTokenEmailVerify: jest.fn().mockResolvedValue({ sub: 'acc-1', email: 'jane@example.com' }),
            generateTokenEmailVerify: jest.fn().mockResolvedValue({ emailVerificationToken: 'verify-token' })
        };
        emailQueue = { add: jest.fn() };
        logger = { debug: jest.fn(), warn: jest.fn() };
        mockedArgon.hash.mockResolvedValue('hashed-code');

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VerificationService,
                OneTimePasscodeService,
                { provide: getRepositoryToken(Account), useValue: accountRepository },
                { provide: AuthService, useValue: authService },
                { provide: getQueueToken('email'), useValue: emailQueue },
                { provide: LoggerService, useValue: logger }
            ]
        }).compile();

        service = module.get(VerificationService);
    });

    describe('issueOneTimePasscode', () => {
        it('stores a hashed 6-digit code, queues the email with the plain code, and returns the challenge', async () => {
            const result = await service.issueOneTimePasscode(account);

            const plainCode = mockedArgon.hash.mock.calls[0][0] as string;
            expect(plainCode).toMatch(/^\d{6}$/);
            expect(accountRepository.update).toHaveBeenCalledWith(
                'acc-1',
                expect.objectContaining({
                    oneTimePasscode: 'hashed-code',
                    oneTimePasscodeAttempts: 0,
                    oneTimePasscodeExpiration: expect.any(Date)
                })
            );
            expect(emailQueue.add).toHaveBeenCalledWith('email-verification', {
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                token: 'verify-token',
                oneTimePasscode: plainCode
            });
            expect(result.emailVerificationToken).toBe('verify-token');
            expect(result.resendAvailableAt.getTime()).toBeGreaterThan(Date.now());
            expect(result.resendAvailableAt.getTime()).toBeLessThanOrEqual(
                Date.now() + OneTimePasscodeService.resendCooldownMS
            );
        });
    });

    describe('emailRequest', () => {
        it('throws BadRequestException when the email is already verified', async () => {
            const verified = {
                ...account,
                verifications: { email: { provider: VerificationProvider.OTP, status: VerificationStatus.Verified } }
            } as unknown as Account;

            await expect(service.emailRequest(verified)).rejects.toThrow(BadRequestException);
            expect(emailQueue.add).not.toHaveBeenCalled();
        });

        it('issues a code when none is live', async () => {
            accountRepository.findOneOrFail.mockResolvedValue({ oneTimePasscodeExpiration: null });

            await service.emailRequest(account);

            expect(emailQueue.add).toHaveBeenCalledWith('email-verification', expect.anything());
        });

        it('issues a code when the previous one has expired', async () => {
            accountRepository.findOneOrFail.mockResolvedValue({ oneTimePasscodeExpiration: past() });

            await service.emailRequest(account);

            expect(emailQueue.add).toHaveBeenCalledWith('email-verification', expect.anything());
        });

        it('does not re-send while a code is live, and still returns a token and cooldown', async () => {
            const expiration = issuedAgo(30 * 1000);
            accountRepository.findOneOrFail.mockResolvedValue({ oneTimePasscodeExpiration: expiration });

            const result = await service.emailRequest(account);

            expect(emailQueue.add).not.toHaveBeenCalled();
            expect(accountRepository.update).not.toHaveBeenCalled();
            expect(result.emailVerificationToken).toBe('verify-token');
            expect(result.resendAvailableAt.getTime()).toBe(
                expiration.getTime() - OneTimePasscodeService.lifetimeMS + OneTimePasscodeService.resendCooldownMS
            );
        });
    });

    describe('emailResend', () => {
        const data = { emailVerificationToken: 'token' };

        beforeEach(() => {
            accountRepository.findOne.mockResolvedValue(account);
        });

        it('decodes the token while ignoring expiration', async () => {
            accountRepository.findOneOrFail.mockResolvedValue({ oneTimePasscodeExpiration: null });

            await service.emailResend(data);

            expect(authService.decodeTokenEmailVerify).toHaveBeenCalledWith('token', true);
        });

        it('throws ForbiddenException when the token matches no account', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.emailResend(data)).rejects.toThrow(ForbiddenException);
        });

        it('refuses a deactivated account, sending no code', async () => {
            accountRepository.findOne.mockResolvedValue({ ...account, isActive: false });

            await expect(service.emailResend(data)).rejects.toThrow(new ForbiddenException('Account is deactivated.'));
            expect(emailQueue.add).not.toHaveBeenCalled();
            expect(accountRepository.update).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when the email is already verified', async () => {
            accountRepository.findOne.mockResolvedValue({
                ...account,
                verifications: { email: { provider: VerificationProvider.OTP, status: VerificationStatus.Verified } }
            });

            await expect(service.emailResend(data)).rejects.toThrow(BadRequestException);
        });

        it('throws a 429 with retryAfterSeconds inside the cooldown', async () => {
            accountRepository.findOneOrFail.mockResolvedValue({ oneTimePasscodeExpiration: issuedAgo(10 * 1000) });

            const error = await service.emailResend(data).catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(HttpException);
            expect((error as HttpException).getStatus()).toBe(429);
            expect((error as HttpException).getResponse()).toEqual(
                expect.objectContaining({ retryAfterSeconds: expect.any(Number) })
            );
            expect(emailQueue.add).not.toHaveBeenCalled();
        });

        it('rotates the code once the cooldown has passed', async () => {
            accountRepository.findOneOrFail.mockResolvedValue({ oneTimePasscodeExpiration: issuedAgo(61 * 1000) });

            const result = await service.emailResend(data);

            expect(emailQueue.add).toHaveBeenCalledWith('email-verification', expect.anything());
            expect(result.emailVerificationToken).toBe('verify-token');
        });
    });

    describe('emailConfirm', () => {
        beforeEach(() => {
            accountRepository.findOne.mockResolvedValue(account);
            accountRepository.findOneOrFail.mockResolvedValue({
                oneTimePasscode: 'hashed-code',
                oneTimePasscodeExpiration: future()
            });
            execute.mockResolvedValue({ raw: [{ oneTimePasscodeAttempts: 1 }] });
            mockedArgon.verify.mockResolvedValue(true);
        });

        it('refuses a deactivated account without checking the code', async () => {
            accountRepository.findOne.mockResolvedValue({ ...account, isActive: false });

            await expect(
                service.emailConfirm({ emailVerificationToken: 'token', oneTimePasscode: '123456' })
            ).rejects.toThrow(new ForbiddenException('Account is deactivated.'));
            expect(execute).not.toHaveBeenCalled();
            expect(accountRepository.update).not.toHaveBeenCalled();
        });

        it('throws ForbiddenException when the token matches no account', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.emailConfirm(confirmData)).rejects.toThrow(ForbiddenException);
        });

        it('throws BadRequestException when the email is already verified', async () => {
            accountRepository.findOne.mockResolvedValue({
                ...account,
                verifications: { email: { provider: VerificationProvider.OTP, status: VerificationStatus.Verified } }
            });

            await expect(service.emailConfirm(confirmData)).rejects.toThrow(BadRequestException);
        });

        it('throws BadRequestException when no code has been issued', async () => {
            accountRepository.findOneOrFail.mockResolvedValue({
                oneTimePasscode: null,
                oneTimePasscodeExpiration: null
            });

            await expect(service.emailConfirm(confirmData)).rejects.toThrow('This code has expired.');
            expect(execute).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when the code has expired', async () => {
            accountRepository.findOneOrFail.mockResolvedValue({
                oneTimePasscode: 'hashed-code',
                oneTimePasscodeExpiration: past()
            });

            await expect(service.emailConfirm(confirmData)).rejects.toThrow('This code has expired.');
        });

        it('rejects without comparing once attempts exceed the cap', async () => {
            execute.mockResolvedValue({ raw: [{ oneTimePasscodeAttempts: OneTimePasscodeService.maxAttempts + 1 }] });

            await expect(service.emailConfirm(confirmData)).rejects.toThrow('Too many incorrect attempts.');
            expect(mockedArgon.verify).not.toHaveBeenCalled();
        });

        it('reports the remaining attempts on a wrong code', async () => {
            mockedArgon.verify.mockResolvedValue(false);
            execute.mockResolvedValue({ raw: [{ oneTimePasscodeAttempts: 2 }] });

            await expect(service.emailConfirm(confirmData)).rejects.toThrow('Incorrect code. 3 attempts remaining.');
            expect(accountRepository.update).not.toHaveBeenCalled();
        });

        it('invalidates the code on the final wrong attempt', async () => {
            mockedArgon.verify.mockResolvedValue(false);
            execute.mockResolvedValue({ raw: [{ oneTimePasscodeAttempts: OneTimePasscodeService.maxAttempts }] });

            await expect(service.emailConfirm(confirmData)).rejects.toThrow('Too many incorrect attempts.');
            expect(accountRepository.update).toHaveBeenCalledWith('acc-1', {
                oneTimePasscode: null,
                oneTimePasscodeExpiration: null
            });
        });

        it('still accepts the correct code on the final attempt', async () => {
            execute.mockResolvedValue({ raw: [{ oneTimePasscodeAttempts: OneTimePasscodeService.maxAttempts }] });

            await expect(service.emailConfirm(confirmData)).resolves.toBeDefined();
        });

        it('records the verification, preserves other records, clears the challenge, and queues the welcome email', async () => {
            const result = await service.emailConfirm(confirmData);

            expect(accountRepository.update).toHaveBeenCalledWith('acc-1', {
                verifications: {
                    phone: account.verifications?.phone,
                    email: {
                        provider: VerificationProvider.OTP,
                        status: VerificationStatus.Verified,
                        verifiedOn: expect.any(Date)
                    }
                },
                oneTimePasscode: null,
                oneTimePasscodeExpiration: null,
                oneTimePasscodeAttempts: 0,
                lastMFAValidatedAt: expect.any(Date)
            });
            expect(emailQueue.add).toHaveBeenCalledWith('welcome-email', {
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com'
            });
            expect(result).toEqual({ message: 'Your email address has been verified.' });
        });

        it('verifies an account that has no verifications yet', async () => {
            accountRepository.findOne.mockResolvedValue({ ...account, verifications: null });

            await service.emailConfirm(confirmData);

            expect(accountRepository.update).toHaveBeenCalledWith(
                'acc-1',
                expect.objectContaining({
                    verifications: { email: expect.objectContaining({ status: VerificationStatus.Verified }) }
                })
            );
        });
    });
});
