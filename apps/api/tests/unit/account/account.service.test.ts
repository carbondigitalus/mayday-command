// NPM Modules
import { ConflictException, ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon from 'argon2';
import { QueryFailedError } from 'typeorm';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import AccountService from 'src/account/account.service';
import AuthService from 'src/auth/auth.service';
import Account from 'src/database/account.entity';
import LoggerService from 'src/logger/logger.service';
import MFAService from 'src/mfa/mfa.service';
import VerificationService from 'src/verification/verification.service';

jest.mock('argon2');

const mockedArgon = argon as jest.Mocked<typeof argon>;

describe('AccountService', () => {
    let service: AccountService;
    let accountRepository: {
        findOne: jest.Mock;
        findAndCount: jest.Mock;
        preload: jest.Mock;
        save: jest.Mock;
        create: jest.Mock;
        find: jest.Mock;
        update: jest.Mock;
        createQueryBuilder: jest.Mock;
        exists: jest.Mock;
        manager: { transaction: jest.Mock };
    };
    /** The transaction's entity manager, which setupAdmin uses for its locked check-and-insert. */
    let manager: {
        create: jest.Mock;
        exists: jest.Mock;
        find: jest.Mock;
        findOne: jest.Mock;
        query: jest.Mock;
        save: jest.Mock;
        update: jest.Mock;
    };
    let authService: {
        createCookieLogin: jest.Mock;
        createCookieLogout: jest.Mock;
        generateTokenLogin: jest.Mock;
        decodeTokenPasswordReset: jest.Mock;
        generateTokenPasswordReset: jest.Mock;
    };
    let emailQueue: { add: jest.Mock };
    let mfaService: { isChallengeRequired: jest.Mock; startChallenge: jest.Mock };
    let verificationService: { issueOneTimePasscode: jest.Mock };
    let logger: {
        debug: jest.Mock;
        warn: jest.Mock;
        error: jest.Mock;
        log: jest.Mock;
    };

    const res = {} as any;

    beforeEach(async () => {
        jest.clearAllMocks();

        accountRepository = {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            preload: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
            exists: jest.fn().mockResolvedValue(false),
            manager: {
                transaction: jest.fn((work: (transactionManager: typeof manager) => Promise<unknown>) => work(manager))
            }
        };
        manager = {
            create: jest.fn((_entity: unknown, data: Partial<Account>) => data),
            exists: jest.fn().mockResolvedValue(false),
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            query: jest.fn(),
            save: jest.fn((account: Partial<Account>) => Promise.resolve({ id: 'admin-1', ...account })),
            update: jest.fn()
        };
        authService = {
            createCookieLogin: jest.fn(),
            createCookieLogout: jest.fn(),
            generateTokenLogin: jest.fn(),
            decodeTokenPasswordReset: jest.fn(),
            generateTokenPasswordReset: jest.fn()
        };
        emailQueue = { add: jest.fn() };
        mfaService = { isChallengeRequired: jest.fn().mockReturnValue(false), startChallenge: jest.fn() };
        verificationService = {
            issueOneTimePasscode: jest.fn().mockResolvedValue({ emailVerificationToken: 'verify-token' })
        };
        logger = {
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccountService,
                {
                    provide: getRepositoryToken(Account),
                    useValue: accountRepository
                },
                { provide: AuthService, useValue: authService },
                { provide: getQueueToken('email'), useValue: emailQueue },
                { provide: LoggerService, useValue: logger },
                { provide: MFAService, useValue: mfaService },
                { provide: VerificationService, useValue: verificationService }
            ]
        }).compile();

        service = module.get(AccountService);
    });

    describe('activate', () => {
        it('activates an existing account', async () => {
            const user = { id: '1' } as Account;
            const preloaded = { id: '1', isActive: true } as Account;
            const saved = { id: '1', isActive: true } as Account;
            accountRepository.findOne.mockResolvedValue(user);
            accountRepository.preload.mockResolvedValue(preloaded);
            accountRepository.save.mockResolvedValue(saved);

            const result = await service.activate({ id: '1' });

            expect(accountRepository.preload).toHaveBeenCalledWith({
                id: '1',
                isActive: true
            });
            expect(accountRepository.save).toHaveBeenCalledWith(preloaded);
            expect(result).toBe(saved);
        });

        it('throws NotFoundException when account does not exist', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.activate({ id: '1' } as any)).rejects.toThrow(NotFoundException);
            expect(logger.warn).toHaveBeenCalled();
        });

        it('records performedBy in the log line when given', async () => {
            const user = { id: '1' } as Account;
            accountRepository.findOne.mockResolvedValue(user);
            accountRepository.preload.mockResolvedValue(user);
            accountRepository.save.mockResolvedValue(user);

            await service.activate({ id: '1' }, 'admin-1');

            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('performed by admin-1'),
                'AccountService-activate'
            );
        });
    });

    describe('deactivate', () => {
        it('deactivates an existing account', async () => {
            const user = { id: '1' } as Account;
            const preloaded = { id: '1', isActive: false } as Account;
            accountRepository.findOne.mockResolvedValue(user);
            accountRepository.preload.mockResolvedValue(preloaded);
            accountRepository.save.mockResolvedValue(preloaded);

            const result = await service.deactivate({ id: '1' });

            expect(accountRepository.preload).toHaveBeenCalledWith({
                id: '1',
                isActive: false
            });
            expect(result).toBe(preloaded);
        });

        it('throws NotFoundException when account does not exist', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.deactivate({ id: '1' } as any)).rejects.toThrow(NotFoundException);
        });

        it('records performedBy in the log line when given', async () => {
            const user = { id: '1' } as Account;
            accountRepository.findOne.mockResolvedValue(user);
            accountRepository.preload.mockResolvedValue(user);
            accountRepository.save.mockResolvedValue(user);

            await service.deactivate({ id: '1' }, 'admin-1');

            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('performed by admin-1'),
                'AccountService-deactivate'
            );
        });
    });

    describe('adminSearch', () => {
        it('normalizes page/limit and returns the paginated result', async () => {
            const accounts = [{ id: '1' } as Account];
            accountRepository.findAndCount.mockResolvedValue([accounts, 1]);

            const result = await service.adminSearch({ page: '2', limit: '10' });

            expect(accountRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({ where: {}, skip: 10, take: 10 })
            );
            expect(result).toEqual({ data: accounts, total: 1, page: 2, limit: 10 });
        });

        it('defaults page to 1 and limit to 25 when not given', async () => {
            accountRepository.findAndCount.mockResolvedValue([[], 0]);

            const result = await service.adminSearch({});

            expect(accountRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 25 }));
            expect(result.page).toBe(1);
            expect(result.limit).toBe(25);
        });

        it('applies the exact isActive filter', async () => {
            accountRepository.findAndCount.mockResolvedValue([[], 0]);

            await service.adminSearch({
                isActive: 'true'
            });

            expect(accountRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        isActive: true
                    }
                })
            );
        });

        it('builds an OR-across-fields where clause when search is given', async () => {
            accountRepository.findAndCount.mockResolvedValue([[], 0]);

            await service.adminSearch({ search: 'jane' });

            const call = accountRepository.findAndCount.mock.calls[0][0];
            expect(Array.isArray(call.where)).toBe(true);
            expect(call.where).toHaveLength(3);
            expect(Object.keys(call.where[0])).toEqual(['email']);
            expect(Object.keys(call.where[1])).toEqual(['firstName']);
            expect(Object.keys(call.where[2])).toEqual(['lastName']);
        });
    });

    describe('adminFindOne', () => {
        it('returns the account with the organizations it belongs to', async () => {
            const account = { id: '1' } as Account;
            accountRepository.findOne.mockResolvedValue(account);

            const result = await service.adminFindOne('1');

            expect(accountRepository.findOne).toHaveBeenCalledWith({
                where: { id: '1' },
                relations: { organizationList: true }
            });
            expect(result).toBe(account);
        });

        it('throws NotFoundException when account does not exist', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.adminFindOne('1')).rejects.toThrow(NotFoundException);
        });
    });

    /** Stubs the atomic counter bump to report the post-increment attempt count. */
    const reserveAttempt = (attempts: number) => {
        const builder: any = {
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockReturnThis(),
            execute: jest
                .fn()
                .mockResolvedValue({ raw: [{ loginAttempts: attempts, passwordChangeAttempts: attempts }] })
        };
        accountRepository.createQueryBuilder.mockReturnValue(builder);
    };

    describe('login', () => {
        beforeEach(() => {
            reserveAttempt(1);
        });

        it('locks the account out on the fifth wrong password (429)', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'hashed' });
            mockedArgon.verify.mockResolvedValue(false);
            reserveAttempt(5);

            await expect(service.login({ email: 'a@b.com', password: 'wrong' } as any, res)).rejects.toMatchObject({
                status: 429
            });

            expect(accountRepository.update).toHaveBeenCalledWith('1', {
                loginAttempts: 0,
                loginLockedUntil: expect.any(Date)
            });
        });

        it('keeps the generic message for wrong passwords short of the cap', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'hashed' });
            mockedArgon.verify.mockResolvedValue(false);
            reserveAttempt(4);

            await expect(service.login({ email: 'a@b.com', password: 'wrong' } as any, res)).rejects.toThrow(
                new ForbiddenException('Email or password incorrect.')
            );
        });

        it('refuses while locked (429), without hashing or counting another attempt', async () => {
            accountRepository.findOne.mockResolvedValue({
                id: '1',
                email: 'a@b.com',
                password: 'hashed',
                loginLockedUntil: new Date(Date.now() + 60_000)
            });

            await expect(service.login({ email: 'a@b.com', password: 'right' } as any, res)).rejects.toMatchObject({
                status: 429
            });

            expect(mockedArgon.verify).not.toHaveBeenCalled();
            expect(accountRepository.createQueryBuilder).not.toHaveBeenCalled();
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
        });

        it('clears the attempt count on a correct password', async () => {
            accountRepository.findOne.mockResolvedValue({
                id: '1',
                email: 'a@b.com',
                password: 'hashed',
                isActive: true
            });
            mockedArgon.verify.mockResolvedValue(true);
            reserveAttempt(3);

            await service.login({ email: 'a@b.com', password: 'right' } as any, res);

            expect(accountRepository.update).toHaveBeenCalledWith('1', { loginAttempts: 0, loginLockedUntil: null });
        });

        it('throws ForbiddenException when email is missing', async () => {
            await expect(service.login({ email: '' } as any, res)).rejects.toThrow(ForbiddenException);
            expect(accountRepository.findOne).not.toHaveBeenCalled();
        });

        it('throws ForbiddenException when user is not found', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.login({ email: 'a@b.com', password: 'x' } as any, res)).rejects.toThrow(
                ForbiddenException
            );
        });

        it('throws ForbiddenException when password is incorrect', async () => {
            accountRepository.findOne.mockResolvedValue({
                id: '1',
                email: 'a@b.com',
                password: 'hashed'
            });
            mockedArgon.verify.mockResolvedValue(false);

            await expect(service.login({ email: 'a@b.com', password: 'wrong' } as any, res)).rejects.toThrow(
                ForbiddenException
            );
        });

        it('throws ForbiddenException when the account is deactivated', async () => {
            accountRepository.findOne.mockResolvedValue({
                id: '1',
                email: 'a@b.com',
                password: 'hashed',
                isActive: false
            });
            mockedArgon.verify.mockResolvedValue(true);

            await expect(service.login({ email: 'a@b.com', password: 'correct' } as any, res)).rejects.toThrow(
                ForbiddenException
            );
        });

        it('signs the account in and records lastLoginAt, without re-saving the account', async () => {
            const account = { id: '1', email: 'a@b.com', password: 'hashed', isActive: true };
            accountRepository.findOne.mockResolvedValue(account);
            mockedArgon.verify.mockResolvedValue(true);
            authService.createCookieLogin.mockResolvedValue({ status: 'success' });

            const result = await service.login({ email: 'A@B.com', password: 'correct' }, res);

            expect(accountRepository.findOne).toHaveBeenCalledWith(
                expect.objectContaining({ where: { email: 'a@b.com' } })
            );
            expect(authService.createCookieLogin).toHaveBeenCalledWith(account, res);
            expect(accountRepository.update).toHaveBeenCalledWith('1', { lastLoginAt: expect.any(Date) });
            expect(accountRepository.preload).not.toHaveBeenCalled();
            expect(accountRepository.save).not.toHaveBeenCalled();
            expect(result).toEqual({ status: 'success' });
        });

        it('asks for what the 2FA check needs when loading the user', async () => {
            const user = { id: '1', email: 'a@b.com', password: 'hashed', isActive: true };
            accountRepository.findOne.mockResolvedValue(user);
            mockedArgon.verify.mockResolvedValue(true);
            accountRepository.preload.mockResolvedValue(user);
            accountRepository.save.mockResolvedValue(user);
            authService.createCookieLogin.mockResolvedValue({});

            await service.login({ email: 'a@b.com', password: 'correct' }, res);

            expect(accountRepository.findOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    select: expect.objectContaining({
                        firstName: true,
                        lastName: true,
                        verifications: true,
                        lastMFAValidatedAt: true
                    })
                })
            );
        });

        it('returns a challenge and issues NO cookie when 2FA has lapsed', async () => {
            const user = { id: '1', email: 'a@b.com', password: 'hashed', isActive: true };
            const challenge = { mfaRequired: true, mfaToken: 'mfa-token' };
            accountRepository.findOne.mockResolvedValue(user);
            mockedArgon.verify.mockResolvedValue(true);
            mfaService.isChallengeRequired.mockReturnValue(true);
            mfaService.startChallenge.mockResolvedValue(challenge);

            const result = await service.login({ email: 'a@b.com', password: 'correct' }, res);

            expect(mfaService.isChallengeRequired).toHaveBeenCalledWith(user);
            expect(mfaService.startChallenge).toHaveBeenCalledWith(user);
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
            expect(accountRepository.update).not.toHaveBeenCalledWith('1', { lastLoginAt: expect.any(Date) });
            expect(result).toBe(challenge);
        });

        it('does not start a challenge when the password is wrong', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'hashed' });
            mockedArgon.verify.mockResolvedValue(false);
            mfaService.isChallengeRequired.mockReturnValue(true);

            await expect(service.login({ email: 'a@b.com', password: 'wrong' } as any, res)).rejects.toThrow(
                ForbiddenException
            );
            expect(mfaService.startChallenge).not.toHaveBeenCalled();
        });

        it('does not start a challenge for a deactivated account', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', password: 'hashed', isActive: false });
            mockedArgon.verify.mockResolvedValue(true);
            mfaService.isChallengeRequired.mockReturnValue(true);

            await expect(service.login({ email: 'a@b.com', password: 'correct' } as any, res)).rejects.toThrow(
                ForbiddenException
            );
            expect(mfaService.startChallenge).not.toHaveBeenCalled();
        });
    });

    describe('logout', () => {
        it('delegates to authService.createCookieLogout', () => {
            authService.createCookieLogout.mockReturnValue('logged-out');

            const result = service.logout(res);

            expect(authService.createCookieLogout).toHaveBeenCalledWith(res);
            expect(result).toBe('logged-out');
        });
    });

    describe('passwordChange', () => {
        beforeEach(() => {
            // the current password checks out unless a test says otherwise
            mockedArgon.verify.mockResolvedValue(true);
            reserveAttempt(1);
        });

        it('throws ForbiddenException when user is not found', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(
                service.passwordChange(
                    '1',
                    { currentPassword: 'old-pw', password: 'a', passwordConfirm: 'a' } as any,
                    res
                )
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws ForbiddenException when passwords do not match', async () => {
            accountRepository.findOne.mockResolvedValue({
                id: '1',
                email: 'a@b.com',
                password: 'stored-hash'
            });

            await expect(
                service.passwordChange(
                    '1',
                    { currentPassword: 'old-pw', password: 'a', passwordConfirm: 'b' } as any,
                    res
                )
            ).rejects.toThrow(ForbiddenException);
        });

        it('asks for the stored password hash, which is not selected by default', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'stored-hash' });
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.preload.mockResolvedValue({ id: '1' });
            accountRepository.save.mockResolvedValue({ id: '1' });

            await service.passwordChange('1', { currentPassword: 'old-pw', password: 'a', passwordConfirm: 'a' }, res);

            expect(accountRepository.findOne).toHaveBeenCalledWith({
                select: { email: true, id: true, password: true, passwordChangeLockedUntil: true },
                where: { id: '1' }
            });
            expect(mockedArgon.verify).toHaveBeenCalledWith('stored-hash', 'old-pw');
        });

        it('refuses a wrong current password (403), changing nothing and issuing no cookie', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'stored-hash' });
            mockedArgon.verify.mockResolvedValue(false);

            await expect(
                service.passwordChange('1', { currentPassword: 'wrong', password: 'a', passwordConfirm: 'a' }, res)
            ).rejects.toThrow(new ForbiddenException('Current password is incorrect. 4 attempts remaining.'));

            expect(mockedArgon.hash).not.toHaveBeenCalled();
            expect(accountRepository.save).not.toHaveBeenCalled();
            expect(emailQueue.add).not.toHaveBeenCalled();
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
        });

        it('locks the account out of password changes on the fifth wrong current password (429)', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'stored-hash' });
            mockedArgon.verify.mockResolvedValue(false);
            reserveAttempt(5);

            await expect(
                service.passwordChange('1', { currentPassword: 'wrong', password: 'a', passwordConfirm: 'a' }, res)
            ).rejects.toMatchObject({ status: 429 });

            expect(accountRepository.update).toHaveBeenCalledWith('1', {
                passwordChangeAttempts: 0,
                passwordChangeLockedUntil: expect.any(Date)
            });
            expect(mockedArgon.hash).not.toHaveBeenCalled();
        });

        it('refuses while locked (429), without checking the password or counting another attempt', async () => {
            accountRepository.findOne.mockResolvedValue({
                id: '1',
                email: 'a@b.com',
                password: 'stored-hash',
                passwordChangeLockedUntil: new Date(Date.now() + 60_000)
            });

            await expect(
                service.passwordChange('1', { currentPassword: 'old-pw', password: 'a', passwordConfirm: 'a' }, res)
            ).rejects.toMatchObject({ status: 429 });

            expect(mockedArgon.verify).not.toHaveBeenCalled();
            expect(accountRepository.createQueryBuilder).not.toHaveBeenCalled();
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
        });

        it('lets the change through once the lockout has passed', async () => {
            accountRepository.findOne.mockResolvedValue({
                id: '1',
                email: 'a@b.com',
                password: 'stored-hash',
                passwordChangeLockedUntil: new Date(Date.now() - 1000)
            });
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.preload.mockResolvedValue({ id: '1' });
            accountRepository.save.mockResolvedValue({ id: '1' });

            await service.passwordChange('1', { currentPassword: 'old-pw', password: 'a', passwordConfirm: 'a' }, res);

            expect(accountRepository.save).toHaveBeenCalled();
        });

        it('clears the attempt count when the current password is right', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'stored-hash' });
            reserveAttempt(3);
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.preload.mockResolvedValue({ id: '1' });
            accountRepository.save.mockResolvedValue({ id: '1' });

            await service.passwordChange('1', { currentPassword: 'old-pw', password: 'a', passwordConfirm: 'a' }, res);

            expect(accountRepository.update).toHaveBeenCalledWith('1', {
                passwordChangeAttempts: 0,
                passwordChangeLockedUntil: null
            });
        });

        it('refuses a new password that is the same as the current one (403)', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'stored-hash' });

            await expect(
                service.passwordChange(
                    '1',
                    { currentPassword: 'same-pw', password: 'same-pw', passwordConfirm: 'same-pw' },
                    res
                )
            ).rejects.toThrow(new ForbiddenException('New password must be different from your current password.'));

            expect(mockedArgon.hash).not.toHaveBeenCalled();
            expect(accountRepository.save).not.toHaveBeenCalled();
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
        });

        it('logs a wrong current password by account ID, never the email', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'stored-hash' });
            mockedArgon.verify.mockResolvedValue(false);

            await service
                .passwordChange('1', { currentPassword: 'wrong', password: 'a', passwordConfirm: 'a' }, res)
                .catch(() => undefined);

            expect(logger.warn).toHaveBeenCalledWith(
                'Password change failed for 1: Current password is incorrect.',
                'AccountService-passwordChange'
            );
            expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('a@b.com');
        });

        it('checks the current password before whether the new ones match', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'stored-hash' });
            mockedArgon.verify.mockResolvedValue(false);

            await expect(
                service.passwordChange('1', { currentPassword: 'wrong', password: 'a', passwordConfirm: 'b' }, res)
            ).rejects.toThrow('Current password is incorrect.');
        });

        it('updates the password on success', async () => {
            const user = { id: '1', email: 'a@b.com', password: 'stored-hash' };
            const updatedUser = {
                id: '1',
                email: 'a@b.com',
                firstName: 'F',
                lastName: 'L'
            };
            accountRepository.findOne.mockResolvedValue(user);
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.preload.mockResolvedValue(updatedUser);
            accountRepository.save.mockResolvedValue(updatedUser);
            authService.createCookieLogin.mockResolvedValue('cookie');

            const result = await service.passwordChange(
                '1',
                { currentPassword: 'old-pw', password: 'a', passwordConfirm: 'a' },
                res
            );

            expect(mockedArgon.hash).toHaveBeenCalledWith('a');
            expect(emailQueue.add).toHaveBeenCalledWith(
                'password-reset-done',
                expect.objectContaining({ email: 'a@b.com' })
            );
            expect(authService.createCookieLogin).toHaveBeenCalledWith(user, res);
            // already authenticated: re-issuing the cookie must not trigger a 2FA challenge
            expect(mfaService.isChallengeRequired).not.toHaveBeenCalled();
            expect(result).toBe('cookie');
        });
    });

    describe('passwordForgot', () => {
        it('gives an unknown email the same answer as a real one, sending and saving nothing', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            const result = await service.passwordForgot({ email: 'a@b.com' });

            expect(result).toEqual({
                message: 'If an account exists for that email, please check your inbox for instructions.'
            });
            expect(authService.generateTokenPasswordReset).not.toHaveBeenCalled();
            expect(accountRepository.save).not.toHaveBeenCalled();
            expect(emailQueue.add).not.toHaveBeenCalled();
        });

        it('stores only an argon2 hash of the reset token, and emails the token itself', async () => {
            const user = { id: '1', email: 'a@b.com' };
            accountRepository.findOne.mockResolvedValue(user);
            authService.generateTokenPasswordReset.mockResolvedValue({ passwordResetToken: 'reset-token' });
            accountRepository.preload.mockResolvedValue({
                ...user,
                firstName: 'F',
                lastName: 'L'
            });
            accountRepository.save.mockResolvedValue({});
            mockedArgon.hash.mockResolvedValue('reset-token-hash');

            const result = await service.passwordForgot({ email: 'a@b.com' });

            expect(authService.generateTokenPasswordReset).toHaveBeenCalledWith('1');
            expect(mockedArgon.hash).toHaveBeenCalledWith('reset-token');
            expect(accountRepository.preload).toHaveBeenCalledWith({
                id: '1',
                passwordResetToken: 'reset-token-hash'
            });
            expect(emailQueue.add).toHaveBeenCalledWith(
                'password-reset-init',
                expect.objectContaining({ token: 'reset-token' })
            );
            expect(result).toEqual({
                message: 'If an account exists for that email, please check your inbox for instructions.'
            });
            expect(JSON.stringify(result)).not.toContain('reset-token');
        });
    });

    describe('passwordReset', () => {
        /** Stubs the account lookup, which selects the hidden `passwordResetToken` hash alongside the account. */
        const findAccount = (account: Partial<Account> | null) => {
            const builder = {
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(account)
            };
            accountRepository.createQueryBuilder.mockReturnValue(builder);
            return builder;
        };

        const currentAccount = (overrides: Partial<Account> = {}): Partial<Account> => ({
            id: '1',
            email: 'a@b.com',
            isActive: true,
            passwordResetToken: 'stored-hash',
            ...overrides
        });

        beforeEach(() => {
            authService.decodeTokenPasswordReset.mockResolvedValue({ sub: '1' });
            mockedArgon.verify.mockResolvedValue(true);
        });

        it('decodes the token, then loads that account with its stored hash', async () => {
            const builder = findAccount(null);

            await expect(
                service.passwordReset({ token: 'token', password: 'a', passwordConfirm: 'a' }, res)
            ).rejects.toThrow(ForbiddenException);

            expect(authService.decodeTokenPasswordReset).toHaveBeenCalledWith('token');
            expect(builder.addSelect).toHaveBeenCalledWith('account.passwordResetToken');
            expect(builder.where).toHaveBeenCalledWith('account.id = :id', { id: '1' });
        });

        it('passes a bad or expired token through without touching the database', async () => {
            authService.decodeTokenPasswordReset.mockRejectedValue(new ForbiddenException('Invalid token.'));

            await expect(
                service.passwordReset({ token: 'token', password: 'a', passwordConfirm: 'a' }, res)
            ).rejects.toThrow(new ForbiddenException('Invalid token.'));
            expect(accountRepository.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('refuses a token that no longer matches the stored hash, such as one replaced by a newer link', async () => {
            findAccount(currentAccount());
            mockedArgon.verify.mockResolvedValue(false);

            await expect(
                service.passwordReset({ token: 'token', password: 'a', passwordConfirm: 'a' }, res)
            ).rejects.toThrow(new ForbiddenException('This reset link is no longer valid. Try forgot password again.'));
            expect(mockedArgon.verify).toHaveBeenCalledWith('stored-hash', 'token');
            expect(accountRepository.save).not.toHaveBeenCalled();
        });

        it('refuses a token once it has been used, when no hash is stored', async () => {
            findAccount(currentAccount({ passwordResetToken: null }));

            await expect(
                service.passwordReset({ token: 'token', password: 'a', passwordConfirm: 'a' }, res)
            ).rejects.toThrow(new ForbiddenException('This reset link is no longer valid. Try forgot password again.'));
            expect(mockedArgon.verify).not.toHaveBeenCalled();
        });

        it('refuses a deactivated account without changing anything or signing in', async () => {
            findAccount(currentAccount({ isActive: false }));

            await expect(
                service.passwordReset({ token: 'token', password: 'a', passwordConfirm: 'a' }, res)
            ).rejects.toThrow(new ForbiddenException('Account is deactivated.'));

            expect(mockedArgon.hash).not.toHaveBeenCalled();
            expect(accountRepository.save).not.toHaveBeenCalled();
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
            expect(mfaService.startChallenge).not.toHaveBeenCalled();
        });

        it('throws ForbiddenException when passwords do not match', async () => {
            findAccount(currentAccount());

            await expect(
                service.passwordReset({ token: 'token', password: 'a', passwordConfirm: 'b' }, res)
            ).rejects.toThrow(new ForbiddenException('Passwords do not match.'));
        });

        it('resets the password on success, clearing the stored hash and any lockout', async () => {
            const account = currentAccount();
            findAccount(account);
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.preload.mockResolvedValue({ ...account, firstName: 'F', lastName: 'L' });
            accountRepository.save.mockResolvedValue({});
            authService.createCookieLogin.mockResolvedValue('cookie');

            const result = await service.passwordReset({ token: 'token', password: 'a', passwordConfirm: 'a' }, res);

            expect(accountRepository.preload).toHaveBeenCalledWith(
                expect.objectContaining({
                    password: 'hashed-pw',
                    passwordResetToken: null,
                    loginAttempts: 0,
                    loginLockedUntil: null
                })
            );
            expect(result).toBe('cookie');
        });

        it('counts the reset as a fresh 2FA check, so no second code is sent to the same inbox', async () => {
            const account = currentAccount({ lastMFAValidatedAt: null });
            findAccount(account);
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.preload.mockResolvedValue({ ...account, firstName: 'F', lastName: 'L' });
            accountRepository.save.mockResolvedValue({});
            authService.createCookieLogin.mockResolvedValue('cookie');

            await service.passwordReset({ token: 'token', password: 'a', passwordConfirm: 'a' }, res);

            const [preloaded] = accountRepository.preload.mock.calls[0] as [Partial<Account>];
            expect(preloaded.lastMFAValidatedAt).toBeInstanceOf(Date);
            expect(preloaded.lastMFAValidatedAt).toBe(preloaded.passwordChangedAt);
            expect(mfaService.isChallengeRequired).toHaveBeenCalledWith(
                expect.objectContaining({ lastMFAValidatedAt: preloaded.lastMFAValidatedAt })
            );
        });
    });

    describe('assignRole', () => {
        const relation = { add: jest.fn(), of: jest.fn() };

        beforeEach(() => {
            relation.of.mockReturnValue(relation);
            accountRepository.createQueryBuilder.mockReturnValue({ relation: jest.fn().mockReturnValue(relation) });
        });

        it('adds the account to the organization and sets the role only where it has none', async () => {
            await service.assignRole('acc-1', AccountRole.OrganizationMember, 'org-1');

            expect(accountRepository.exists).toHaveBeenCalledWith({
                where: { id: 'acc-1', organizationList: { id: 'org-1' } }
            });
            expect(relation.of).toHaveBeenCalledWith('acc-1');
            expect(relation.add).toHaveBeenCalledWith('org-1');
            expect(accountRepository.update).toHaveBeenCalledWith(
                { id: 'acc-1', role: expect.anything() },
                { role: AccountRole.OrganizationMember }
            );
        });

        it('does not add a membership the account already has', async () => {
            accountRepository.exists.mockResolvedValue(true);

            await service.assignRole('acc-1', AccountRole.OrganizationMember, 'org-1');

            expect(relation.add).not.toHaveBeenCalled();
        });

        it('only sets the role when no organization is given', async () => {
            await service.assignRole('acc-1', AccountRole.PlatformAgent);

            expect(accountRepository.exists).not.toHaveBeenCalled();
            expect(accountRepository.update).toHaveBeenCalledTimes(1);
        });
    });

    describe('changeRole', () => {
        it("sets the account's role", async () => {
            manager.findOne.mockResolvedValue({ id: 'acc-1', role: AccountRole.OrganizationMember });

            const result = await service.changeRole('acc-1', AccountRole.PlatformAgent);

            expect(manager.update).toHaveBeenCalledWith(Account, 'acc-1', { role: AccountRole.PlatformAgent });
            expect(manager.find).not.toHaveBeenCalled();
            expect(result).toEqual({ id: 'acc-1', role: AccountRole.PlatformAgent });
        });

        it('changes a platform admin when another platform admin remains, locking them for the check', async () => {
            manager.findOne.mockResolvedValue({ id: 'acc-1', role: AccountRole.PlatformAdmin });
            manager.find.mockResolvedValue([{ id: 'acc-1' }, { id: 'acc-2' }]);

            await service.changeRole('acc-1', AccountRole.PlatformAgent);

            expect(manager.find).toHaveBeenCalledWith(Account, {
                where: { role: AccountRole.PlatformAdmin },
                select: { id: true },
                lock: { mode: 'pessimistic_write' }
            });
            expect(manager.update).toHaveBeenCalled();
        });

        it("refuses to change the install's last platform admin", async () => {
            manager.findOne.mockResolvedValue({ id: 'acc-1', role: AccountRole.PlatformAdmin });
            manager.find.mockResolvedValue([{ id: 'acc-1' }]);

            await expect(service.changeRole('acc-1', AccountRole.PlatformAgent)).rejects.toThrow(
                new ForbiddenException('The install must keep at least one platform admin.')
            );
            expect(manager.update).not.toHaveBeenCalled();
        });

        it('returns 404 for an account that does not exist', async () => {
            manager.findOne.mockResolvedValue(null);

            await expect(service.changeRole('acc-9', AccountRole.PlatformAgent)).rejects.toThrow(
                new NotFoundException('Account not found.')
            );
        });
    });

    describe('isSetupAdminRequired', () => {
        it('reports setup as required while no platform:admin exists', async () => {
            await expect(service.isSetupAdminRequired()).resolves.toEqual({ setupRequired: true });
            expect(accountRepository.exists).toHaveBeenCalledWith({ where: { role: AccountRole.PlatformAdmin } });
        });

        it('reports setup as done once a platform:admin exists', async () => {
            accountRepository.exists.mockResolvedValue(true);

            await expect(service.isSetupAdminRequired()).resolves.toEqual({ setupRequired: false });
        });
    });

    describe('setupAdmin', () => {
        const data = {
            email: 'Admin@Example.com',
            firstName: 'Ada',
            lastName: 'Admin',
            password: 'Sup3rSecure!Pass',
            passwordConfirm: 'Sup3rSecure!Pass'
        };

        beforeEach(() => {
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            authService.createCookieLogin.mockResolvedValue({ status: 'success' });
        });

        it('creates the first account as platform:admin under the setup lock, then signs it in', async () => {
            const result = await service.setupAdmin(data, res);

            expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1)', [expect.any(Number)]);
            expect(manager.create).toHaveBeenCalledWith(Account, {
                email: 'admin@example.com',
                firstName: 'Ada',
                lastName: 'Admin',
                password: 'hashed-pw',
                role: AccountRole.PlatformAdmin
            });
            expect(verificationService.issueOneTimePasscode).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'admin-1' })
            );
            expect(authService.createCookieLogin).toHaveBeenCalledWith(expect.objectContaining({ id: 'admin-1' }), res);
            expect(result).toEqual({ status: 'success', emailVerificationToken: 'verify-token' });
        });

        it('takes the lock before checking for an existing admin', async () => {
            await service.setupAdmin(data, res);

            expect(manager.query.mock.invocationCallOrder[0]).toBeLessThan(manager.exists.mock.invocationCallOrder[0]);
        });

        it('refuses once a platform:admin exists (409), creating nothing and signing no one in', async () => {
            manager.exists.mockResolvedValueOnce(true);

            await expect(service.setupAdmin(data, res)).rejects.toThrow(
                new ConflictException('This install already has an admin.')
            );
            expect(manager.save).not.toHaveBeenCalled();
            expect(authService.createCookieLogin).not.toHaveBeenCalled();
        });

        it('refuses an email that another account already uses', async () => {
            manager.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

            await expect(service.setupAdmin(data, res)).rejects.toThrow(
                new ForbiddenException('An account already uses this email address.')
            );
            expect(manager.save).not.toHaveBeenCalled();
        });

        it('refuses mismatched passwords before touching the database', async () => {
            await expect(service.setupAdmin({ ...data, passwordConfirm: 'different' }, res)).rejects.toThrow(
                new ForbiddenException('Passwords do not match.')
            );
            expect(accountRepository.manager.transaction).not.toHaveBeenCalled();
        });
    });

    describe('register', () => {
        it('throws ForbiddenException when passwords do not match', async () => {
            await expect(
                service.register({
                    email: 'a@b.com',
                    password: 'a',
                    passwordConfirm: 'b'
                } as any)
            ).rejects.toThrow(new ForbiddenException('Passwords do not match.'));
        });

        it('registers a new user on success', async () => {
            const createdUser = {
                id: '1',
                email: 'a@b.com',
                firstName: 'F',
                lastName: 'L'
            };
            const savedUser = { ...createdUser };
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.create.mockReturnValue(createdUser);
            accountRepository.save.mockResolvedValue(savedUser);

            const result = await service.register({
                email: 'A@B.com',
                firstName: 'F',
                lastName: 'L',
                password: 'a',
                passwordConfirm: 'a'
            });

            expect(accountRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'a@b.com',
                    password: 'hashed-pw'
                })
            );
            expect(verificationService.issueOneTimePasscode).toHaveBeenCalledWith(savedUser);
            expect(emailQueue.add).not.toHaveBeenCalledWith('welcome-email', expect.anything());
            expect(result).toEqual({ account: savedUser, emailVerificationToken: 'verify-token' });
        });

        it('throws ForbiddenException on a unique-constraint violation (23505)', async () => {
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.create.mockReturnValue({
                id: '1',
                email: 'a@b.com'
            });
            const duplicateError = new QueryFailedError('query', [], {
                code: '23505',
                message: 'duplicate key value'
            } as unknown as Error);
            accountRepository.save.mockRejectedValue(duplicateError);

            await expect(
                service.register({
                    email: 'a@b.com',
                    password: 'a',
                    passwordConfirm: 'a'
                } as any)
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws InternalServerErrorException for other QueryFailedErrors', async () => {
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.create.mockReturnValue({
                id: '1',
                email: 'a@b.com'
            });
            const otherError = new QueryFailedError('query', [], {
                code: '99999',
                message: 'some other db error'
            } as unknown as Error);
            accountRepository.save.mockRejectedValue(otherError);

            await expect(
                service.register({
                    email: 'a@b.com',
                    password: 'a',
                    passwordConfirm: 'a'
                } as any)
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('throws InternalServerErrorException for unexpected Error instances', async () => {
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.create.mockReturnValue({
                id: '1',
                email: 'a@b.com'
            });
            accountRepository.save.mockRejectedValue(new Error('boom'));

            await expect(
                service.register({
                    email: 'a@b.com',
                    password: 'a',
                    passwordConfirm: 'a'
                } as any)
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('throws InternalServerErrorException for non-Error rejections', async () => {
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.create.mockReturnValue({
                id: '1',
                email: 'a@b.com'
            });
            accountRepository.save.mockRejectedValue('a plain string failure');

            await expect(
                service.register({
                    email: 'a@b.com',
                    password: 'a',
                    passwordConfirm: 'a'
                } as any)
            ).rejects.toThrow(InternalServerErrorException);
        });

        it('stores the submitted name and leaves verifications alone', async () => {
            mockedArgon.hash.mockResolvedValue('hashed-pw');
            accountRepository.create.mockReturnValue({ id: 'user-1', email: 'a@b.com' });
            accountRepository.save.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });

            await service.register({
                email: 'a@b.com',
                firstName: 'Jane',
                lastName: 'Doe',
                password: 'a',
                passwordConfirm: 'a'
            });

            expect(accountRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({ firstName: 'Jane', lastName: 'Doe' })
            );
            expect(accountRepository.preload).not.toHaveBeenCalled();
        });
    });

    describe('get', () => {
        it('throws ForbiddenException when user is not found', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.get({ id: '1' } as any)).rejects.toThrow(ForbiddenException);
        });

        it('returns the session account, with its grants, looked up by its own ID', async () => {
            const user = { id: '1', email: 'a@b.com' };
            accountRepository.findOne.mockResolvedValue(user);

            const result = await service.get({ id: '1', email: 'a@b.com' } as any);

            expect(accountRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: '1' } }));
            expect(result).toBe(user);
        });
    });

    describe('readAll', () => {
        it('throws NotFoundException when no users are found', async () => {
            accountRepository.find.mockResolvedValue([]);

            await expect(service.readAll()).rejects.toThrow(NotFoundException);
        });

        it('returns users on success', async () => {
            const users = [{ id: '1' }, { id: '2' }];
            accountRepository.find.mockResolvedValue(users);

            const result = await service.readAll();

            expect(result).toBe(users);
        });
    });

    describe('updateAccount', () => {
        it('throws ForbiddenException when the requesting user is not found', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(service.updateAccount({ firstName: 'F', lastName: 'L' }, '1')).rejects.toThrow(
                ForbiddenException
            );
            expect(accountRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
        });

        it("updates the requester's own account on success", async () => {
            const account = { id: '1', email: 'a@b.com' };
            const updated = { id: '1', firstName: 'F', lastName: 'L' };
            accountRepository.findOne.mockResolvedValue(account);
            accountRepository.preload.mockResolvedValue(updated);
            accountRepository.save.mockResolvedValue(updated);

            const result = await service.updateAccount({ firstName: 'F', lastName: 'L' }, '1');

            expect(accountRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(accountRepository.preload).toHaveBeenCalledWith({ firstName: 'F', id: '1', lastName: 'L' });
            expect(result).toBe(updated);
        });
    });
});
