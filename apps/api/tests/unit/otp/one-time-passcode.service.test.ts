// Core Modules
import { randomInt } from 'node:crypto';

// Custom Modules
import OneTimePasscodeService from 'src/otp/one-time-passcode.service';

jest.mock('node:crypto', () => ({
    ...jest.requireActual<typeof import('node:crypto')>('node:crypto'),
    randomInt: jest.fn()
}));

const mockedRandomInt = randomInt as jest.Mock;

describe('OneTimePasscodeService', () => {
    const service = new OneTimePasscodeService();

    describe('limits', () => {
        it('allows codes ten minutes, five tries, and a one-minute resend wait', () => {
            expect(OneTimePasscodeService.lifetimeMS).toBe(10 * 60 * 1000);
            expect(OneTimePasscodeService.maxAttempts).toBe(5);
            expect(OneTimePasscodeService.resendCooldownMS).toBe(60 * 1000);
        });
    });

    describe('generate', () => {
        it('draws from 0 to 999999 using the secure generator', () => {
            mockedRandomInt.mockReturnValue(123456);

            expect(service.generate()).toBe('123456');
            expect(mockedRandomInt).toHaveBeenCalledWith(0, 1_000_000);
        });

        it('zero-pads short numbers to six digits', () => {
            mockedRandomInt.mockReturnValue(42);

            expect(service.generate()).toBe('000042');
        });
    });

    describe('hash and matches', () => {
        it('stores something other than the code, and matches only the right code', async () => {
            const hash = await service.hash('123456');

            expect(hash).not.toContain('123456');
            await expect(service.matches(hash, '123456')).resolves.toBe(true);
            await expect(service.matches(hash, '654321')).resolves.toBe(false);
        });

        it.each(['', 'not-an-argon2-hash', '$P$BOldWordPressHash'])(
            'treats a stored value argon2 cannot read (%p) as no match instead of throwing',
            async (badHash) => {
                await expect(service.matches(badHash, '123456')).resolves.toBe(false);
            }
        );
    });

    describe('timing', () => {
        const issuedAt = new Date('2026-10-11T12:00:00.000Z');

        it('expires a code ten minutes after it was issued', () => {
            expect(service.getExpiresAt(issuedAt)).toEqual(new Date('2026-10-11T12:10:00.000Z'));
        });

        it('recovers the issue time from the expiry', () => {
            expect(service.getIssuedAt(service.getExpiresAt(issuedAt))).toEqual(issuedAt);
        });

        it('allows a resend one minute after a code was issued', () => {
            expect(service.getResendAvailableAt(issuedAt)).toEqual(new Date('2026-10-11T12:01:00.000Z'));
        });
    });
});
