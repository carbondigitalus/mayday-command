// NPM Modules
import { CallHandler, ClassSerializerInterceptor, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

// Custom Modules
import MFAChallenge from 'src/database/mfa-challenge.entity';

describe('MFAChallenge serialization', () => {
    it('never serializes the stored code hash', async () => {
        const interceptor = new ClassSerializerInterceptor(new Reflector());
        const context = { getClass: () => Object, getHandler: () => () => undefined } as unknown as ExecutionContext;
        const challenge = Object.assign(new MFAChallenge(), {
            id: 'challenge-1',
            attempts: 2,
            codeHash: '$argon2id$hash'
        });

        const plain = (await lastValueFrom(
            await interceptor.intercept(context, { handle: () => of(challenge) } as CallHandler)
        )) as Record<string, unknown>;

        expect(plain).toMatchObject({ id: 'challenge-1', attempts: 2 });
        expect(plain).not.toHaveProperty('codeHash');
    });
});
