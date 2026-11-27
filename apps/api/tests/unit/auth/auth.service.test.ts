// NPM Modules
import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

// Custom Modules
import AuthService from 'src/auth/auth.service';
import Account from 'src/database/account.entity';
import LoggerService from 'src/logger/logger.service';
import { decryptToken, encryptToken } from 'src/utils/helpers/tokenCipher';

process.env.COOKIE_NAME = 'mayday-command-session';
process.env.JWT_ENCRYPTION_KEY = 'test-encryption-key';

describe('AuthService', () => {
    let service: AuthService;
    let jwt: { decode: jest.Mock; verifyAsync: jest.Mock; signAsync: jest.Mock };
    let logger: {
        debug: jest.Mock;
        warn: jest.Mock;
        error: jest.Mock;
        log: jest.Mock;
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        jwt = {
            decode: jest.fn(),
            verifyAsync: jest.fn(),
            signAsync: jest.fn()
        };
        logger = {
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: JwtService, useValue: jwt },
                { provide: LoggerService, useValue: logger }
            ]
        }).compile();

        service = module.get(AuthService);
    });

    const buildRes = (): any => {
        const res: any = {};
        res.cookie = jest.fn().mockReturnValue(res);
        res.clearCookie = jest.fn().mockReturnValue(res);
        return res;
    };

    const account = { id: '1', email: 'a@b.com' } as Account;
    const tokenExp = 1_800_000_000;

    describe('createCookieLogin', () => {
        beforeEach(() => {
            jwt.signAsync.mockResolvedValueOnce('access-token');
            jwt.decode.mockReturnValue({ exp: tokenExp });
        });

        it('sets the login cookie, httpOnly, and does not hand the token back in the response', async () => {
            const res = buildRes();

            const result = await service.createCookieLogin(account, res);

            expect(res.cookie).toHaveBeenCalledWith(
                'mayday-command-session',
                expect.any(String),
                expect.objectContaining({ httpOnly: true })
            );
            expect(decryptToken(res.cookie.mock.calls[0][1])).toBe('access-token');
            expect(result).toEqual({ status: 'success' });
        });

        it('expires the cookie when the token itself expires', async () => {
            const res = buildRes();

            await service.createCookieLogin(account, res);

            expect(jwt.decode).toHaveBeenCalledWith('access-token');
            expect(res.cookie).toHaveBeenCalledWith(
                'mayday-command-session',
                expect.any(String),
                expect.objectContaining({ expires: new Date(tokenExp * 1000) })
            );
        });

        it('uses a "lax", non-secure cookie outside production', async () => {
            const res = buildRes();

            await service.createCookieLogin(account, res);

            expect(res.cookie).toHaveBeenCalledWith(
                'mayday-command-session',
                expect.any(String),
                expect.objectContaining({ sameSite: 'lax', secure: false })
            );
        });

        it('uses a "none", secure cookie in production', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            try {
                const res = buildRes();

                await service.createCookieLogin(account, res);

                expect(res.cookie).toHaveBeenCalledWith(
                    'mayday-command-session',
                    expect.any(String),
                    expect.objectContaining({ sameSite: 'none', secure: true })
                );
            } finally {
                process.env.NODE_ENV = originalEnv;
            }
        });

        it('passes a signing failure through without setting a cookie', async () => {
            jwt.signAsync.mockReset();
            jwt.signAsync.mockRejectedValue(new Error('sign failure'));
            const res = buildRes();

            await expect(service.createCookieLogin(account, res)).rejects.toThrow('sign failure');
            expect(res.cookie).not.toHaveBeenCalled();
        });
    });

    describe('createCookieLogout', () => {
        it('clears the cookie with the options it was set with, and returns success', async () => {
            jwt.signAsync.mockResolvedValueOnce('access-token');
            jwt.decode.mockReturnValue({ exp: tokenExp });
            const res = buildRes();

            await service.createCookieLogin(account, res);
            const result = service.createCookieLogout(res);

            const { expires: _expires, ...setOptions } = res.cookie.mock.calls[0][2];
            expect(res.clearCookie).toHaveBeenCalledWith('mayday-command-session', setOptions);
            expect(result).toEqual({ status: 'success' });
        });
    });

    describe('decodeTokenEmailVerify', () => {
        it('decodes a valid token', async () => {
            const future = Math.floor(Date.now() / 1000) + 10000;
            jwt.verifyAsync.mockResolvedValue({
                tokenType: 'email-verify-token',
                exp: future,
                sub: '1',
                email: 'a@b.com',
                iat: 0
            });

            const result = await service.decodeTokenEmailVerify(encryptToken('token'));

            expect(result.tokenType).toBe('email-verify-token');
        });

        it('passes ignoreExpiration to the jwt library and skips the manual expiry check when asked', async () => {
            jwt.verifyAsync.mockResolvedValue({
                tokenType: 'email-verify-token',
                exp: Math.floor(Date.now() / 1000) - 10000,
                sub: '1',
                email: 'a@b.com',
                iat: 0
            });

            const result = await service.decodeTokenEmailVerify(encryptToken('token'), true);

            expect(jwt.verifyAsync).toHaveBeenCalledWith('token', expect.objectContaining({ ignoreExpiration: true }));
            expect(result.sub).toBe('1');
        });

        it('rejects a token of another type (403)', async () => {
            jwt.verifyAsync.mockResolvedValue({ tokenType: 'access-token' });

            await expect(service.decodeTokenEmailVerify(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('Invalid token type.')
            );
        });

        it('tells the user to request a new link when the token has expired (403)', async () => {
            jwt.verifyAsync.mockRejectedValue(new TokenExpiredError('jwt expired', new Date()));

            await expect(service.decodeTokenEmailVerify(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('Your email verification session has expired. Please request a new one.')
            );
        });

        it('rejects a token with a bad signature (403)', async () => {
            jwt.verifyAsync.mockRejectedValue(new JsonWebTokenError('invalid signature'));

            await expect(service.decodeTokenEmailVerify(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('Invalid token.')
            );
        });

        it('rejects anything else that goes wrong while verifying, as an invalid token (403)', async () => {
            jwt.verifyAsync.mockRejectedValue(new Error('boom'));

            await expect(service.decodeTokenEmailVerify(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('Invalid token.')
            );
        });
    });

    describe('decodeTokenPasswordReset', () => {
        it('decodes a valid reset token using the password reset secret', async () => {
            process.env.JWT_TOKEN_PASSWORD_RESET_SECRET = 'reset-secret';
            jwt.verifyAsync.mockResolvedValue({ tokenType: 'password-reset-token', sub: 'acc-1' });

            const result = await service.decodeTokenPasswordReset(encryptToken('token'));

            expect(jwt.verifyAsync).toHaveBeenCalledWith('token', expect.objectContaining({ secret: 'reset-secret' }));
            expect(result.sub).toBe('acc-1');
        });

        it('tells the user to request a new link when the token has expired (403)', async () => {
            jwt.verifyAsync.mockRejectedValue(new TokenExpiredError('jwt expired', new Date()));

            await expect(service.decodeTokenPasswordReset(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('This reset link has expired. Try forgot password again.')
            );
        });
    });

    describe('token encryption', () => {
        it('rejects a raw, unencrypted JWT before verifying it (403)', async () => {
            await expect(service.decodeTokenEmailVerify('raw.jwt.token')).rejects.toThrow(
                new ForbiddenException('Invalid token.')
            );
            expect(jwt.verifyAsync).not.toHaveBeenCalled();
        });

        it('rejects a token that was altered after encryption (403)', async () => {
            const encrypted = encryptToken('token');
            const altered = `${encrypted.slice(0, -2)}${encrypted.endsWith('AA') ? 'BB' : 'AA'}`;

            await expect(service.decodeTokenEmailVerify(altered)).rejects.toThrow(
                new ForbiddenException('Invalid token.')
            );
            expect(jwt.verifyAsync).not.toHaveBeenCalled();
        });
    });

    describe('decodeTokenInvitation', () => {
        it('decodes a valid invitation token using the invitation secret', async () => {
            process.env.JWT_TOKEN_INVITATION_SECRET = 'invitation-secret';
            jwt.verifyAsync.mockResolvedValue({ tokenType: 'invitation-token', sub: 'inv-1' });

            const result = await service.decodeTokenInvitation(encryptToken('token'));

            expect(jwt.verifyAsync).toHaveBeenCalledWith(
                'token',
                expect.objectContaining({ secret: 'invitation-secret' })
            );
            expect(result.sub).toBe('inv-1');
        });

        it('rejects a token of another type (403)', async () => {
            jwt.verifyAsync.mockResolvedValue({ tokenType: 'email-verify-token' });

            await expect(service.decodeTokenInvitation(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('Invalid token type.')
            );
        });

        it('tells the user to request a new invitation when the token has expired (403)', async () => {
            jwt.verifyAsync.mockRejectedValue(new TokenExpiredError('jwt expired', new Date()));

            await expect(service.decodeTokenInvitation(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('This invitation has expired. Please request a new one.')
            );
        });
    });

    describe('generateTokenEmailVerify', () => {
        it('generates a token on success', async () => {
            jwt.signAsync.mockResolvedValue('email-verify-token');

            const result = await service.generateTokenEmailVerify('1', 'a@b.com');

            expect(decryptToken(result.emailVerificationToken)).toBe('email-verify-token');
        });

        it('passes a signing failure through unchanged', async () => {
            jwt.signAsync.mockRejectedValue(new Error('boom'));

            await expect(service.generateTokenEmailVerify('1', 'a@b.com')).rejects.toThrow('boom');
        });
    });

    describe('generateTokenInvitation', () => {
        it('signs the token to expire exactly when the invitation does, and encrypts it', async () => {
            process.env.JWT_TOKEN_INVITATION_SECRET = 'invitation-secret';
            jwt.signAsync.mockResolvedValue('invitation-token');
            const expiresAt = new Date('2026-12-04T12:00:00.000Z');

            const result = await service.generateTokenInvitation('invite-1', expiresAt);

            expect(jwt.signAsync).toHaveBeenCalledWith(
                { exp: Math.floor(expiresAt.getTime() / 1000), sub: 'invite-1', tokenType: 'invitation-token' },
                { secret: 'invitation-secret' }
            );
            expect(decryptToken(result.invitationToken)).toBe('invitation-token');
        });
    });

    describe('generateTokenLogin', () => {
        it('generates the access token on success, expiring when the token itself does', async () => {
            jwt.signAsync.mockResolvedValueOnce('access-token');
            jwt.decode.mockReturnValue({ exp: 1_800_000_000 });

            const result = await service.generateTokenLogin('1');

            expect(jwt.signAsync).toHaveBeenCalledWith({ sub: '1', tokenType: 'access-token' }, expect.anything());
            expect(decryptToken(result.accessToken)).toBe('access-token');
            expect(result.accessTokenExpires).toEqual(new Date(1_800_000_000 * 1000));
        });

        it('passes a signing failure through unchanged', async () => {
            jwt.signAsync.mockRejectedValue(new Error('boom'));

            await expect(service.generateTokenLogin('1')).rejects.toThrow('boom');
        });
    });

    describe('generateTokenPasswordReset', () => {
        it('signs a password reset token for the account, with no email in it, and encrypts it', async () => {
            jwt.signAsync.mockResolvedValue('reset-token');

            const result = await service.generateTokenPasswordReset('1');

            expect(jwt.signAsync).toHaveBeenCalledWith(
                { sub: '1', tokenType: 'password-reset-token' },
                expect.anything()
            );
            expect(decryptToken(result.passwordResetToken)).toBe('reset-token');
            expect(result).toEqual({ passwordResetToken: expect.any(String) });
        });

        it('passes a signing failure through unchanged', async () => {
            jwt.signAsync.mockRejectedValue(new Error('boom'));

            await expect(service.generateTokenPasswordReset('1')).rejects.toThrow('boom');
        });
    });

    describe('generateTokenMFAChallenge', () => {
        const originalEnv = { ...process.env };

        beforeEach(() => {
            process.env.JWT_TOKEN_MFA_CHALLENGE_SECRET = 'mfa-secret';
            process.env.JWT_TOKEN_MFA_CHALLENGE_EXPIRES_IN = '15m';
        });

        afterEach(() => {
            process.env = { ...originalEnv };
        });

        it('signs a challenge token with its own secret, lifetime and token type', async () => {
            jwt.signAsync.mockResolvedValue('signed');

            const result = await service.generateTokenMFAChallenge('acc-1', 'challenge-1');

            expect(decryptToken(result.mfaChallengeToken)).toBe('signed');
            expect(jwt.signAsync).toHaveBeenCalledWith(
                { sub: 'acc-1', challengeID: 'challenge-1', tokenType: 'mfa-challenge-token' },
                { expiresIn: '15m', secret: 'mfa-secret' }
            );
        });
    });

    describe('decodeTokenMFAChallenge', () => {
        it('decodes a valid challenge token using the MFA secret', async () => {
            process.env.JWT_TOKEN_MFA_CHALLENGE_SECRET = 'mfa-secret';
            const payload = {
                sub: 'acc-1',
                email: 'a@b.com',
                challengeID: 'challenge-1',
                tokenType: 'mfa-challenge-token'
            };
            jwt.verifyAsync.mockResolvedValue(payload);

            const result = await service.decodeTokenMFAChallenge(encryptToken('token'));

            expect(result).toEqual(payload);
            expect(jwt.verifyAsync).toHaveBeenCalledWith('token', { secret: 'mfa-secret' });
        });

        it('rejects a token of another type, such as a login or email-verify token', async () => {
            jwt.verifyAsync.mockResolvedValue({ tokenType: 'access-token' });

            await expect(service.decodeTokenMFAChallenge(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('Invalid token type.')
            );
        });

        it('tells the user to log in again when the token has expired', async () => {
            jwt.verifyAsync.mockRejectedValue(new TokenExpiredError('jwt expired', new Date()));

            await expect(service.decodeTokenMFAChallenge(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('Your login session has expired. Please log in again.')
            );
        });

        it('rejects a token with a bad signature', async () => {
            jwt.verifyAsync.mockRejectedValue(new JsonWebTokenError('invalid signature'));

            await expect(service.decodeTokenMFAChallenge(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('Invalid token.')
            );
        });

        it('rejects anything else that goes wrong while verifying, as an invalid token', async () => {
            jwt.verifyAsync.mockRejectedValue('a plain string failure');

            await expect(service.decodeTokenMFAChallenge(encryptToken('token'))).rejects.toThrow(
                new ForbiddenException('Invalid token.')
            );
        });
    });
});
