// NPM Modules
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Custom Modules
import JWTAccessTokenGuard from 'src/utils/guards/JWTAccessTokenGuard.guard';
import VerificationProvider from '@mayday-command/utils/enums/VerificationProvider.enum';
import VerificationStatus from '@mayday-command/utils/enums/VerificationStatus.enum';

describe('JWTAccessTokenGuard', () => {
    let guard: JWTAccessTokenGuard;
    let reflector: { getAllAndOverride: jest.Mock };

    const handler = () => undefined;
    class TestController {}
    const context = {
        getClass: () => TestController,
        getHandler: () => handler
    } as any;

    const verifiedUser = {
        id: '1',
        email: 'a@b.com',
        verifications: {
            email: { provider: VerificationProvider.OTP, status: VerificationStatus.Verified }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
        guard = new JWTAccessTokenGuard(reflector as unknown as Reflector);
    });

    describe('handleRequest', () => {
        it('returns the account when authentication succeeds and email is verified', () => {
            const result = guard.handleRequest(null, verifiedUser, null, context, undefined);

            expect(result).toBe(verifiedUser);
        });

        it('throws the provided error when authentication fails', () => {
            const error = new Error('auth failed');

            expect(() => {
                guard.handleRequest(error, false, null, context, undefined);
            }).toThrow(error);
        });

        it('throws an UnauthorizedException when there is no account and no error', () => {
            expect(() => {
                guard.handleRequest(null, false, 'no auth token', context, undefined);
            }).toThrow();
        });

        it('throws ForbiddenException when the email is not verified', () => {
            const account = { id: '1', email: 'a@b.com', verifications: null };

            expect(() => guard.handleRequest(null, account, null, context, undefined)).toThrow(
                new ForbiddenException('Verification required: email.')
            );
        });

        it('lets an unverified account through a route marked @AllowUnverifiedEmail()', () => {
            const account = { id: '1', email: 'a@b.com' };
            reflector.getAllAndOverride.mockReturnValue(true);

            const result = guard.handleRequest(null, account, null, context, undefined);

            expect(result).toBe(account);
            expect(reflector.getAllAndOverride).toHaveBeenCalledWith('allowUnverifiedEmail', [handler, TestController]);
        });
    });
});
