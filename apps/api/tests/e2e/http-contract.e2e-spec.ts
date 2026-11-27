// NPM Modules
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { sign } from 'jsonwebtoken';
import request from 'supertest';

// Custom Modules
import AccountController from 'src/account/account.controller';
import AccountService from 'src/account/account.service';
import AssetsController from 'src/assets/assets.controller';
import AssetsService from 'src/assets/assets.service';
import configureApp from 'src/app.setup';
import Account from 'src/database/account.entity';
import LoggerService from 'src/logger/logger.service';
import MessageQueueController from 'src/message-queue/mq.controller';
import MessageQueueService from 'src/message-queue/mq.service';
import MFAController from 'src/mfa/mfa.controller';
import MFAService from 'src/mfa/mfa.service';
import AllowUnverifiedEmail from 'src/utils/decorators/AllowUnverifiedEmail.decorator';
import JWTAccessTokenGuard from 'src/utils/guards/JWTAccessTokenGuard.guard';
import RolesGuard from 'src/utils/guards/RolesGuard.guard';
import TooManyRequestsException from 'src/utils/exceptions/TooManyRequests.exception';
import TooManyRequestsFilter from 'src/utils/filters/TooManyRequests.filter';
import { encryptToken } from 'src/utils/helpers/tokenCipher';
import AccessTokenStrategy from 'src/utils/strategy/AccessTokenStrategy.strategy';
import VerificationController from 'src/verification/verification.controller';
import VerificationService from 'src/verification/verification.service';
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';
import VerificationProvider from '@mayday-command/utils/enums/VerificationProvider.enum';
import VerificationStatus from '@mayday-command/utils/enums/VerificationStatus.enum';

/** A route that exists only here, so the verification guard can be exercised
 * on its own, with one route that opts out of it and one that doesn't. */
@Controller('probe')
@UseGuards(JWTAccessTokenGuard)
class ProbeController {
    @Get('protected')
    protectedRoute() {
        return 'protected-ok';
    }

    @AllowUnverifiedEmail()
    @Get('open')
    openRoute() {
        return 'open-ok';
    }
}

const accessSecret = 'e2e-access-secret';
const cookieName = 'mayday-command-session';

const verifiedEmail = { email: { provider: VerificationProvider.OTP, status: VerificationStatus.Verified } };

/** Accounts the mocked repository knows about, keyed by email. */
const accounts: Record<string, Partial<Account>> = {
    'deactivated@example.com': {
        id: 'acc-d',
        email: 'deactivated@example.com',
        isActive: false,
        verifications: verifiedEmail
    },
    'staff@example.com': {
        id: 'acc-s',
        email: 'staff@example.com',
        isActive: true,
        role: AccountRole.PlatformAdmin,
        verifications: verifiedEmail
    },
    'unverified@example.com': { id: 'acc-u', email: 'unverified@example.com', isActive: true, verifications: null },
    'unverified-staff@example.com': {
        id: 'acc-us',
        email: 'unverified-staff@example.com',
        isActive: true,
        role: AccountRole.PlatformAdmin,
        verifications: null
    },
    'verified@example.com': { id: 'acc-v', email: 'verified@example.com', isActive: true, verifications: verifiedEmail }
};

/** The session cookie the real login would set, signed with the real secret. */
const sessionCookie = (email: string) =>
    `${cookieName}=${encryptToken(sign({ sub: accounts[email].id, tokenType: 'access-token' }, accessSecret))}`;

describe('API HTTP contract (e2e)', () => {
    let app: INestApplication;
    let accountService: {
        changeRole: jest.Mock;
        deactivate: jest.Mock;
        get: jest.Mock;
        login: jest.Mock;
        passwordChange: jest.Mock;
        passwordReset: jest.Mock;
        isSetupAdminRequired: jest.Mock;
        readAll: jest.Mock;
        register: jest.Mock;
        setupAdmin: jest.Mock;
        updateAccount: jest.Mock;
    };
    let messageQueueService: { getQueueStats: jest.Mock; removeAllFailedJobs: jest.Mock };
    let mfaService: { resend: jest.Mock; verify: jest.Mock };
    let assetsService: { getDownloadURL: jest.Mock };
    let verificationService: { emailConfirm: jest.Mock; emailRequest: jest.Mock; emailResend: jest.Mock };

    beforeAll(async () => {
        process.env.COOKIE_NAME = cookieName;
        process.env.JWT_ENCRYPTION_KEY = 'e2e-encryption-key';
        process.env.JWT_TOKEN_ACCESS_SECRET = accessSecret;

        accountService = {
            changeRole: jest.fn(),
            deactivate: jest.fn(),
            get: jest.fn(),
            login: jest.fn(),
            passwordChange: jest.fn(),
            passwordReset: jest.fn(),
            isSetupAdminRequired: jest.fn(),
            readAll: jest.fn(),
            register: jest.fn(),
            setupAdmin: jest.fn(),
            updateAccount: jest.fn()
        };
        messageQueueService = { getQueueStats: jest.fn(), removeAllFailedJobs: jest.fn() };
        mfaService = { resend: jest.fn(), verify: jest.fn() };
        assetsService = { getDownloadURL: jest.fn() };
        verificationService = { emailConfirm: jest.fn(), emailRequest: jest.fn(), emailResend: jest.fn() };

        const moduleRef = await Test.createTestingModule({
            controllers: [
                AccountController,
                AssetsController,
                MessageQueueController,
                MFAController,
                ProbeController,
                VerificationController
            ],
            providers: [
                { provide: APP_FILTER, useClass: TooManyRequestsFilter },
                AccessTokenStrategy,
                RolesGuard,
                { provide: AccountService, useValue: accountService },
                { provide: AssetsService, useValue: assetsService },
                {
                    provide: LoggerService,
                    useValue: { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() }
                },
                { provide: MessageQueueService, useValue: messageQueueService },
                { provide: MFAService, useValue: mfaService },
                { provide: VerificationService, useValue: verificationService },
                {
                    provide: getRepositoryToken(Account),
                    useValue: {
                        findOne: async ({ where }: { where: { id: string } }) =>
                            Object.values(accounts).find((account) => account.id === where.id) ?? null
                    }
                }
            ]
        }).compile();

        app = moduleRef.createNestApplication<NestExpressApplication>();
        configureApp(app as NestExpressApplication);
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('session guard', () => {
        it('rejects a request with no session cookie (401), without logging it as an error', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error');

            await request(app.getHttpServer()).get('/probe/protected').expect(401);

            expect(consoleErrorSpy).not.toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });

        it('rejects a cookie that was not signed with the access secret (401)', async () => {
            const forged = sign({ sub: 'acc-v', tokenType: 'access-token' }, 'wrong-secret');

            await request(app.getHttpServer())
                .get('/probe/protected')
                .set('Cookie', `${cookieName}=${encryptToken(forged)}`)
                .expect(401);
        });

        it('rejects a deactivated account (401)', async () => {
            await request(app.getHttpServer())
                .get('/probe/protected')
                .set('Cookie', sessionCookie('deactivated@example.com'))
                .expect(401);
        });

        it('lets a verified account through and wraps the response as { data }', async () => {
            const response = await request(app.getHttpServer())
                .get('/probe/protected')
                .set('Cookie', sessionCookie('verified@example.com'))
                .expect(200);

            expect(response.body).toEqual({ data: 'protected-ok' });
        });

        it('blocks an account whose email is not verified (403 "Verification required: email.")', async () => {
            const response = await request(app.getHttpServer())
                .get('/probe/protected')
                .set('Cookie', sessionCookie('unverified@example.com'))
                .expect(403);

            expect(response.body.message).toBe('Verification required: email.');
        });

        it('still lets an unverified account use a route that opts out', async () => {
            const response = await request(app.getHttpServer())
                .get('/probe/open')
                .set('Cookie', sessionCookie('unverified@example.com'))
                .expect(200);

            expect(response.body).toEqual({ data: 'open-ok' });
        });
    });

    describe('login and the account routes', () => {
        it('answers a login lockout with 429 and a Retry-After header', async () => {
            accountService.login.mockRejectedValue(
                new TooManyRequestsException('Too many incorrect passwords. Please try again in 15 minutes.', 900)
            );

            const response = await request(app.getHttpServer())
                .post('/account/login')
                .send({ email: 'verified@example.com', password: 'whatever' })
                .expect(429);

            expect(response.headers['retry-after']).toBe('900');
            expect(response.body).toEqual(expect.objectContaining({ retryAfterSeconds: 900 }));
        });

        it('returns a second-factor challenge, and sets NO session cookie, when 2FA is due', async () => {
            const challenge = {
                destination: 'v***@example.com',
                method: 'email',
                mfaRequired: true,
                mfaToken: 'mfa-token',
                resendAvailableAt: '2026-10-11T12:01:00.000Z'
            };
            accountService.login.mockResolvedValue(challenge);

            const response = await request(app.getHttpServer())
                .post('/account/login')
                .send({ email: 'verified@example.com', password: 'Sup3rSecure!Pass' })
                .expect(201);

            expect(response.body).toEqual({ data: challenge });
            expect(response.headers['set-cookie']).toBeUndefined();
        });

        it('rejects a malformed login body before it reaches the service (400)', async () => {
            await request(app.getHttpServer())
                .post('/account/login')
                .send({ email: 'not-an-email', password: '' })
                .expect(400);

            expect(accountService.login).not.toHaveBeenCalled();
        });

        it('lets an unverified account read its own account (the route the Portal loads first)', async () => {
            accountService.get.mockResolvedValue({ id: 'acc-u' });

            await request(app.getHttpServer())
                .post('/account')
                .set('Cookie', sessionCookie('unverified@example.com'))
                .expect(201);

            // identified by the session cookie alone: no token in the body
            expect(accountService.get).toHaveBeenCalledWith(expect.objectContaining({ id: 'acc-u' }));
        });

        it('needs a session to change a password (401)', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

            await request(app.getHttpServer())
                .patch('/account/password-change')
                .send({
                    currentPassword: 'Old-Pass-1!',
                    password: 'Sup3rSecure!Pass',
                    passwordConfirm: 'Sup3rSecure!Pass'
                })
                .expect(401);

            expect(accountService.passwordChange).not.toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });

        it('changes the password of the account in the session', async () => {
            accountService.passwordChange.mockResolvedValue({ status: 'success' });

            await request(app.getHttpServer())
                .patch('/account/password-change')
                .set('Cookie', sessionCookie('verified@example.com'))
                .send({
                    currentPassword: 'Old-Pass-1!',
                    password: 'Sup3rSecure!Pass',
                    passwordConfirm: 'Sup3rSecure!Pass'
                })
                .expect(200);

            expect(accountService.passwordChange).toHaveBeenCalledWith(
                'acc-v',
                { currentPassword: 'Old-Pass-1!', password: 'Sup3rSecure!Pass', passwordConfirm: 'Sup3rSecure!Pass' },
                expect.anything()
            );
        });

        it('updates the account in the session, and strips an email sent in the body', async () => {
            accountService.updateAccount.mockResolvedValue({ id: 'acc-v' });

            await request(app.getHttpServer())
                .patch('/account/update')
                .set('Cookie', sessionCookie('verified@example.com'))
                .send({ email: 'someone-else@example.com', firstName: 'F', lastName: 'L' })
                .expect(200);

            expect(accountService.updateAccount).toHaveBeenCalledWith({ firstName: 'F', lastName: 'L' }, 'acc-v');
        });

        it('rejects an empty name on update (400)', async () => {
            await request(app.getHttpServer())
                .patch('/account/update')
                .set('Cookie', sessionCookie('verified@example.com'))
                .send({ firstName: 'F', lastName: '' })
                .expect(400);

            expect(accountService.updateAccount).not.toHaveBeenCalled();
        });

        it('blocks an unverified account from updating its account (403)', async () => {
            await request(app.getHttpServer())
                .patch('/account/update')
                .set('Cookie', sessionCookie('unverified@example.com'))
                .send({ firstName: 'F', lastName: 'L' })
                .expect(403);

            expect(accountService.updateAccount).not.toHaveBeenCalled();
        });
    });

    describe('password strength', () => {
        const weak = 'password';
        const strong = 'Sup3rSecure!Pass';
        const registration = (password: string) => ({
            email: 'new@example.com',
            firstName: 'New',
            lastName: 'User',
            password,
            passwordConfirm: password
        });

        it('rejects a registration with an empty name (400)', async () => {
            await request(app.getHttpServer())
                .post('/account/register')
                .send({ ...registration(strong), firstName: '' })
                .expect(400);

            expect(accountService.register).not.toHaveBeenCalled();
        });

        it('rejects a weak password at registration (400) and names the rule', async () => {
            const response = await request(app.getHttpServer())
                .post('/account/register')
                .send(registration(weak))
                .expect(400);

            expect(response.body.message).toEqual(
                expect.arrayContaining(['Passwords can not be less than 12 characters.'])
            );
            expect(accountService.register).not.toHaveBeenCalled();
        });

        it('accepts a strong password at registration', async () => {
            accountService.register.mockResolvedValue({ account: {}, emailVerificationToken: 'token' });

            await request(app.getHttpServer()).post('/account/register').send(registration(strong)).expect(201);

            expect(accountService.register).toHaveBeenCalledTimes(1);
        });

        it('rejects a weak password on a reset (400)', async () => {
            await request(app.getHttpServer())
                .patch('/account/password-reset')
                .send({ token: 'some-token', password: weak, passwordConfirm: weak })
                .expect(400);

            expect(accountService.passwordReset).not.toHaveBeenCalled();
        });

        it('rejects a reset without a token in the body (400)', async () => {
            await request(app.getHttpServer())
                .patch('/account/password-reset')
                .send({ password: strong, passwordConfirm: strong })
                .expect(400);

            expect(accountService.passwordReset).not.toHaveBeenCalled();
        });

        it('accepts a strong password on a reset', async () => {
            accountService.passwordReset.mockResolvedValue({ status: 'success' });

            await request(app.getHttpServer())
                .patch('/account/password-reset')
                .send({ token: 'some-token', password: strong, passwordConfirm: strong })
                .expect(200);
        });

        it('rejects a weak password on a change (400)', async () => {
            await request(app.getHttpServer())
                .patch('/account/password-change')
                .set('Cookie', sessionCookie('verified@example.com'))
                .send({ currentPassword: 'Old-Pass-1!', password: weak, passwordConfirm: weak })
                .expect(400);

            expect(accountService.passwordChange).not.toHaveBeenCalled();
        });

        it('needs the current password to change one (400)', async () => {
            await request(app.getHttpServer())
                .patch('/account/password-change')
                .set('Cookie', sessionCookie('verified@example.com'))
                .send({ password: strong, passwordConfirm: strong })
                .expect(400);

            expect(accountService.passwordChange).not.toHaveBeenCalled();
        });

        it('does not hold the current password to the strength rule, so an older weak one still works', async () => {
            accountService.passwordChange.mockResolvedValue({ status: 'success' });

            await request(app.getHttpServer())
                .patch('/account/password-change')
                .set('Cookie', sessionCookie('verified@example.com'))
                .send({ currentPassword: weak, password: strong, passwordConfirm: strong })
                .expect(200);
        });

        it('accepts a strong password on a change', async () => {
            accountService.passwordChange.mockResolvedValue({ status: 'success' });

            await request(app.getHttpServer())
                .patch('/account/password-change')
                .set('Cookie', sessionCookie('verified@example.com'))
                .send({ currentPassword: 'Old-Pass-1!', password: strong, passwordConfirm: strong })
                .expect(200);
        });

        it('still lets an account with an older, weaker password log in', async () => {
            accountService.login.mockResolvedValue({ status: 'success' });

            await request(app.getHttpServer())
                .post('/account/login')
                .send({ email: 'verified@example.com', password: weak })
                .expect(201);

            expect(accountService.login).toHaveBeenCalledTimes(1);
        });
    });

    describe('email verification routes', () => {
        it('requires a session to request a code (401)', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

            await request(app.getHttpServer()).post('/verification/email/request').expect(401);

            consoleErrorSpy.mockRestore();
        });

        it('lets an unverified account request a code', async () => {
            verificationService.emailRequest.mockResolvedValue({ emailVerificationToken: 'token' });

            const response = await request(app.getHttpServer())
                .post('/verification/email/request')
                .set('Cookie', sessionCookie('unverified@example.com'))
                .expect(201);

            expect(response.body).toEqual({ data: { emailVerificationToken: 'token' } });
            expect(verificationService.emailRequest).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'acc-u', email: 'unverified@example.com' })
            );
        });

        it('confirms a code without a session, and strips properties the DTO does not declare', async () => {
            verificationService.emailConfirm.mockResolvedValue({ message: 'verified' });

            await request(app.getHttpServer())
                .post('/verification/email/confirm')
                .send({ emailVerificationToken: 'token', oneTimePasscode: '123456', isAdmin: true })
                .expect(201);

            expect(verificationService.emailConfirm).toHaveBeenCalledWith({
                emailVerificationToken: 'token',
                oneTimePasscode: '123456'
            });
        });

        it.each([['12345'], ['1234567'], ['12ab56'], ['']])('rejects the code "%s" (400)', async (oneTimePasscode) => {
            await request(app.getHttpServer())
                .post('/verification/email/confirm')
                .send({ emailVerificationToken: 'token', oneTimePasscode })
                .expect(400);

            expect(verificationService.emailConfirm).not.toHaveBeenCalled();
        });

        it('requires a token to resend (400)', async () => {
            await request(app.getHttpServer()).post('/verification/email/resend').send({}).expect(400);
        });
    });

    describe('login 2FA routes', () => {
        it('verifies a code without a session, and the service can set the session cookie through the response', async () => {
            mfaService.verify.mockImplementation((_data, res) => {
                res.cookie(cookieName, 'new-session');

                return { status: 'success' };
            });

            const response = await request(app.getHttpServer())
                .post('/mfa/verify')
                .send({ mfaToken: 'mfa-token', oneTimePasscode: '123456', extra: 'ignored' })
                .expect(201);

            expect(response.body).toEqual({ data: { status: 'success' } });
            expect(response.headers['set-cookie']).toEqual([expect.stringContaining(`${cookieName}=new-session`)]);
            expect(mfaService.verify).toHaveBeenCalledWith(
                { mfaToken: 'mfa-token', oneTimePasscode: '123456' },
                expect.anything()
            );
        });

        it.each([['12345'], ['abcdef'], ['']])('rejects the code "%s" (400)', async (oneTimePasscode) => {
            await request(app.getHttpServer())
                .post('/mfa/verify')
                .send({ mfaToken: 'mfa-token', oneTimePasscode })
                .expect(400);

            expect(mfaService.verify).not.toHaveBeenCalled();
        });

        it('rejects a verify with no token (400)', async () => {
            await request(app.getHttpServer()).post('/mfa/verify').send({ oneTimePasscode: '123456' }).expect(400);
        });

        it('resends a code without a session', async () => {
            mfaService.resend.mockResolvedValue({ mfaToken: 'fresh-token' });

            const response = await request(app.getHttpServer())
                .post('/mfa/resend')
                .send({ mfaToken: 'mfa-token' })
                .expect(201);

            expect(response.body).toEqual({ data: { mfaToken: 'fresh-token' } });
        });
    });

    describe('token endpoints', () => {
        it.each([['/auth/generate-token/login'], ['/auth/generate-token/password-reset']])(
            'no longer exposes %s, which minted tokens for any account (404)',
            async (path) => {
                await request(app.getHttpServer())
                    .post(path)
                    .set('Cookie', sessionCookie('verified@example.com'))
                    .send({ accountID: 'acc-s', email: 'staff@example.com' })
                    .expect(404);
            }
        );

        it.each([
            ['/auth/decode-token/email-verify/some-token'],
            ['/auth/decode-token/login/some-token'],
            ['/auth/decode-token/password-reset/some-token']
        ])('no longer exposes %s, which put tokens in the URL (404)', async (path) => {
            await request(app.getHttpServer())
                .post(path)
                .set('Cookie', sessionCookie('verified@example.com'))
                .expect(404);
        });
    });

    describe('asset download route', () => {
        const assetID = '0b5c6f3e-8a1d-4f2b-9c7e-1d2a3b4c5d6e';

        it('is closed without a session (401)', async () => {
            await request(app.getHttpServer()).get(`/asset/${assetID}`).expect(401);

            expect(assetsService.getDownloadURL).not.toHaveBeenCalled();
        });

        it('redirects a signed-in account to the signed link, uncached', async () => {
            assetsService.getDownloadURL.mockResolvedValue('https://signed.example/assets/abc');

            const response = await request(app.getHttpServer())
                .get(`/asset/${assetID}`)
                .set('Cookie', sessionCookie('verified@example.com'))
                .expect(302);

            expect(response.headers.location).toBe('https://signed.example/assets/abc');
            expect(response.headers['cache-control']).toBe('private, no-store');
        });

        it('rejects an ID that is not a UUID (400)', async () => {
            await request(app.getHttpServer())
                .get('/asset/not-a-uuid')
                .set('Cookie', sessionCookie('verified@example.com'))
                .expect(400);

            expect(assetsService.getDownloadURL).not.toHaveBeenCalled();
        });
    });

    describe('first-admin setup routes', () => {
        const setupBody = {
            email: 'admin@example.com',
            firstName: 'Ada',
            lastName: 'Admin',
            password: 'Sup3rSecure!Pass',
            passwordConfirm: 'Sup3rSecure!Pass'
        };

        it('reports whether setup is needed, without a session', async () => {
            accountService.isSetupAdminRequired.mockResolvedValue({ setupRequired: true });

            const response = await request(app.getHttpServer()).get('/account/setup-admin').expect(200);

            expect(response.body).toEqual({ data: { setupRequired: true } });
        });

        it('runs setup without a session, passing only the validated fields', async () => {
            accountService.setupAdmin.mockResolvedValue({ status: 'success', emailVerificationToken: 'verify-token' });

            await request(app.getHttpServer())
                .post('/account/setup-admin')
                .send({ ...setupBody, role: 'platform:agent' })
                .expect(201);

            expect(accountService.setupAdmin).toHaveBeenCalledWith(setupBody, expect.anything());
        });

        it('rejects a setup body with a weak password (400)', async () => {
            await request(app.getHttpServer())
                .post('/account/setup-admin')
                .send({ ...setupBody, password: 'weak', passwordConfirm: 'weak' })
                .expect(400);

            expect(accountService.setupAdmin).not.toHaveBeenCalled();
        });
    });

    describe('role change route', () => {
        it('is closed to an account without platform:admin (403)', async () => {
            await request(app.getHttpServer())
                .patch('/account/admin/acc-v/role')
                .set('Cookie', sessionCookie('verified@example.com'))
                .send({ role: AccountRole.PlatformAgent })
                .expect(403);

            expect(accountService.changeRole).not.toHaveBeenCalled();
        });

        it('rejects a role that is not in the catalog (400)', async () => {
            await request(app.getHttpServer())
                .patch('/account/admin/acc-v/role')
                .set('Cookie', sessionCookie('staff@example.com'))
                .send({ role: 'platform:service' })
                .expect(400);

            expect(accountService.changeRole).not.toHaveBeenCalled();
        });

        it('lets a platform admin set a role', async () => {
            accountService.changeRole.mockResolvedValue({ id: 'acc-v', role: AccountRole.PlatformAgent });

            await request(app.getHttpServer())
                .patch('/account/admin/acc-v/role')
                .set('Cookie', sessionCookie('staff@example.com'))
                .send({ role: AccountRole.PlatformAgent })
                .expect(200);

            expect(accountService.changeRole).toHaveBeenCalledWith('acc-v', AccountRole.PlatformAgent);
        });
    });

    describe('account list route', () => {
        it('is closed without a session (401)', async () => {
            await request(app.getHttpServer()).get('/account').expect(401);

            expect(accountService.readAll).not.toHaveBeenCalled();
        });

        it('is closed to a verified account without platform:admin or platform:agent (403)', async () => {
            await request(app.getHttpServer())
                .get('/account')
                .set('Cookie', sessionCookie('verified@example.com'))
                .expect(403);

            expect(accountService.readAll).not.toHaveBeenCalled();
        });

        it('is open to an account with a platform role', async () => {
            accountService.readAll.mockResolvedValue([{ id: 'acc-v' }]);

            const response = await request(app.getHttpServer())
                .get('/account')
                .set('Cookie', sessionCookie('staff@example.com'))
                .expect(200);

            expect(response.body).toEqual({ data: [{ id: 'acc-v' }] });
        });
    });

    describe('account deactivate route', () => {
        it('is closed to a verified account without platform:admin or platform:agent (403)', async () => {
            await request(app.getHttpServer())
                .delete('/account/deactivate')
                .set('Cookie', sessionCookie('verified@example.com'))
                .expect(403);

            expect(accountService.deactivate).not.toHaveBeenCalled();
        });

        it('is open to an account with a platform role', async () => {
            accountService.deactivate.mockResolvedValue({ id: 'acc-s', isActive: false });

            await request(app.getHttpServer())
                .delete('/account/deactivate')
                .set('Cookie', sessionCookie('staff@example.com'))
                .expect(200);

            expect(accountService.deactivate).toHaveBeenCalledTimes(1);
        });
    });

    describe('message-queue routes', () => {
        it('are closed to a verified account that is not staff (403)', async () => {
            await request(app.getHttpServer())
                .get('/message-queue/stats')
                .set('Cookie', sessionCookie('verified@example.com'))
                .expect(403);

            expect(messageQueueService.getQueueStats).not.toHaveBeenCalled();
        });

        it('are open to staff', async () => {
            messageQueueService.getQueueStats.mockResolvedValue({ failed: 2 });

            const response = await request(app.getHttpServer())
                .get('/message-queue/stats')
                .set('Cookie', sessionCookie('staff@example.com'))
                .expect(200);

            expect(response.body).toEqual({ data: { failed: 2 } });
        });

        it('only let staff clear the failed jobs', async () => {
            await request(app.getHttpServer())
                .delete('/message-queue/failed-jobs')
                .set('Cookie', sessionCookie('verified@example.com'))
                .expect(403);
            expect(messageQueueService.removeAllFailedJobs).not.toHaveBeenCalled();

            messageQueueService.removeAllFailedJobs.mockResolvedValue({ removedCount: 3 });
            await request(app.getHttpServer())
                .delete('/message-queue/failed-jobs')
                .set('Cookie', sessionCookie('staff@example.com'))
                .expect(200);
            expect(messageQueueService.removeAllFailedJobs).toHaveBeenCalledTimes(1);
        });

        it('are still closed to staff whose email is not verified (403)', async () => {
            const response = await request(app.getHttpServer())
                .get('/message-queue/stats')
                .set('Cookie', sessionCookie('unverified-staff@example.com'))
                .expect(403);

            expect(response.body.message).toBe('Verification required: email.');
        });
    });
});
