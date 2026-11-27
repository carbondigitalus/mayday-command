// NPM Modules
import { UnauthorizedException } from '@nestjs/common';

// Custom Modules
import TokenTypes from 'src/utils/enums/TokenTypes.enum';
import { encryptToken } from 'src/utils/helpers/tokenCipher';
import AccessTokenStrategy from 'src/utils/strategy/AccessTokenStrategy.strategy';

process.env.COOKIE_NAME = 'mayday-command-session';
process.env.JWT_ENCRYPTION_KEY = 'test-encryption-key';
process.env.JWT_TOKEN_ACCESS_SECRET = 'test-access-secret';

describe('AccessTokenStrategy', () => {
    let strategy: AccessTokenStrategy;
    let accountRepository: { findOne: jest.Mock };
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        accountRepository = { findOne: jest.fn() };
        strategy = new AccessTokenStrategy(accountRepository as any);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('jwtFromRequest extractor', () => {
        it('decrypts the token from the COOKIE_NAME cookie', () => {
            const extractor = (strategy as any)._jwtFromRequest as (req: unknown) => string;
            const request = {
                cookies: { 'mayday-command-session': encryptToken('the-token') }
            };

            const result = extractor(request);

            expect(result).toBe('the-token');
        });

        it('returns null when the cookie is not an encrypted token', () => {
            const extractor = (strategy as any)._jwtFromRequest as (req: unknown) => string | null;

            expect(extractor({ cookies: { 'mayday-command-session': 'raw.jwt.token' } })).toBeNull();
        });

        it('returns null, without logging, when the cookie is missing', () => {
            const extractor = (strategy as any)._jwtFromRequest as (req: unknown) => string | null;
            const request = { cookies: {} };

            expect(extractor(request)).toBeNull();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });

    describe('validate', () => {
        it('looks the account up by the token account ID and returns it when the account is active', async () => {
            const account = { id: '1', email: 'a@b.com', isActive: true };
            accountRepository.findOne.mockResolvedValue(account);

            const result = await strategy.validate({
                sub: 'acc-1',
                exp: 0,
                iat: 0,
                tokenType: TokenTypes.Access
            });

            expect(accountRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'acc-1' }
            });
            expect(result).toBe(account);
        });

        it('answers 401 "Invalid session." when no account has the token account ID', async () => {
            accountRepository.findOne.mockResolvedValue(null);

            await expect(
                strategy.validate({
                    sub: 'acc-1',
                    exp: 0,
                    iat: 0,
                    tokenType: TokenTypes.Access
                })
            ).rejects.toThrow(new UnauthorizedException('Invalid session.'));
        });

        it('throws UnauthorizedException when the account is deactivated', async () => {
            accountRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com', isActive: false });

            await expect(
                strategy.validate({
                    sub: 'acc-1',
                    exp: 0,
                    iat: 0,
                    tokenType: TokenTypes.Access
                })
            ).rejects.toThrow(new UnauthorizedException('Account is deactivated.'));
        });

        describe('after a password change', () => {
            const changedAt = new Date('2026-11-27T12:00:00.750Z');
            const changedAtSeconds = Math.floor(changedAt.getTime() / 1000);
            const validateIssuedAt = (iat: number) =>
                strategy.validate({ sub: 'acc-1', exp: 0, iat, tokenType: TokenTypes.Access });

            beforeEach(() => {
                accountRepository.findOne.mockResolvedValue({
                    id: 'acc-1',
                    email: 'a@b.com',
                    isActive: true,
                    passwordChangedAt: changedAt
                });
            });

            it('refuses a session issued before the change (401)', async () => {
                await expect(validateIssuedAt(changedAtSeconds - 1)).rejects.toThrow(
                    new UnauthorizedException('Your password was changed. Please log in again.')
                );
            });

            it('accepts the session issued in the same second as the change', async () => {
                await expect(validateIssuedAt(changedAtSeconds)).resolves.toMatchObject({ id: 'acc-1' });
            });

            it('accepts a session issued after the change', async () => {
                await expect(validateIssuedAt(changedAtSeconds + 60)).resolves.toMatchObject({ id: 'acc-1' });
            });
        });

        it('answers 401 for a token of another type, without looking up the account', async () => {
            await expect(
                strategy.validate({
                    sub: 'acc-1',
                    exp: 0,
                    iat: 0,
                    tokenType: TokenTypes.PasswordReset
                })
            ).rejects.toThrow(new UnauthorizedException('Invalid token type.'));
            expect(accountRepository.findOne).not.toHaveBeenCalled();
        });
    });
});
