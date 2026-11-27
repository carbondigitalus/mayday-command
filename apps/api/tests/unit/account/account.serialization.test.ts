// NPM Modules
import { CallHandler, ClassSerializerInterceptor, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

// Custom Modules
import Account from 'src/database/account.entity';

describe('Account serialization', () => {
    const interceptor = new ClassSerializerInterceptor(new Reflector());
    const context = { getClass: () => Object, getHandler: () => () => undefined } as unknown as ExecutionContext;

    const serialize = async (value: unknown) =>
        lastValueFrom(await interceptor.intercept(context, { handle: () => of(value) } as CallHandler));

    const buildAccount = () =>
        Object.assign(new Account(), {
            id: 'acc-1',
            email: 'jane@example.com',
            firstName: 'Jane',
            password: '$argon2id$v=19$hash',
            oneTimePasscode: '$argon2id$v=19$code-hash',
            oneTimePasscodeExpiration: new Date('2026-10-11T00:10:00Z'),
            oneTimePasscodeAttempts: 2
        });

    it('keeps the password and one-time passcode challenge out of a serialized account', async () => {
        const plain = (await serialize(buildAccount())) as Record<string, unknown>;

        expect(plain).toMatchObject({ id: 'acc-1', email: 'jane@example.com', firstName: 'Jane' });
        expect(plain).not.toHaveProperty('password');
        expect(plain).not.toHaveProperty('oneTimePasscode');
        expect(plain).not.toHaveProperty('oneTimePasscodeExpiration');
        expect(plain).not.toHaveProperty('oneTimePasscodeAttempts');
    });

    it('also strips them from an account nested in a response object, as register returns it', async () => {
        const plain = (await serialize({ account: buildAccount(), emailVerificationToken: 'token' })) as {
            account: Record<string, unknown>;
            emailVerificationToken: string;
        };

        expect(plain.emailVerificationToken).toBe('token');
        expect(plain.account).toMatchObject({ id: 'acc-1', email: 'jane@example.com' });
        expect(plain.account).not.toHaveProperty('password');
        expect(plain.account).not.toHaveProperty('oneTimePasscode');
    });
});
