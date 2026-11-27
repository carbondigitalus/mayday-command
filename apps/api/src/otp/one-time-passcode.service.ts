// Core Modules
import { randomInt } from 'node:crypto';

// NPM Modules
import { Injectable } from '@nestjs/common';
import * as argon from 'argon2';

/** The mechanics every six-digit-code flow shares (email verification, login
 * 2FA): generating a code, hashing and comparing it, and the lifetime, attempt
 * and resend limits that apply to it. Where a code is stored and how it is
 * delivered stays with each flow, so one flow's code can never satisfy
 * another's. */
@Injectable()
export default class OneTimePasscodeService {
    /** How long a code stays valid after it's issued: 10 minutes. */
    static readonly lifetimeMS = 10 * 60 * 1000;
    /** Wrong guesses allowed on one code before it stops working. */
    static readonly maxAttempts = 5;
    /** How long after a code is issued before another may be requested: 1 minute. */
    static readonly resendCooldownMS = 60 * 1000;

    /** Six digits, zero-padded, from a cryptographically secure source. */
    generate(): string {
        return randomInt(0, 1_000_000).toString().padStart(6, '0');
    }

    /** When a code issued at `issuedAt` stops being valid. */
    getExpiresAt(issuedAt: Date): Date {
        return new Date(issuedAt.getTime() + OneTimePasscodeService.lifetimeMS);
    }

    /** Inverse of {@link getExpiresAt}, for flows that store only the expiry. */
    getIssuedAt(expiresAt: Date): Date {
        return new Date(expiresAt.getTime() - OneTimePasscodeService.lifetimeMS);
    }

    /** The earliest a new code may be requested after one issued at `issuedAt`. */
    getResendAvailableAt(issuedAt: Date): Date {
        return new Date(issuedAt.getTime() + OneTimePasscodeService.resendCooldownMS);
    }

    /** Codes are stored hashed, never in plaintext. */
    hash(code: string): Promise<string> {
        return argon.hash(code);
    }

    /** Constant-time comparison of a submitted code against a stored hash. A stored value argon2 can't read (empty or
     * corrupted) counts as no match, so the caller answers "incorrect code" rather than failing with a 500. Catching
     * here is the intended result, not a defensive wrapper. */
    async matches(hash: string, code: string): Promise<boolean> {
        try {
            return await argon.verify(hash, code);
        } catch {
            return false;
        }
    }
}
