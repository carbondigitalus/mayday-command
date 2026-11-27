// NPM Modules
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

// Shared Modules
import MFAMethod from '@mayday-command/utils/enums/MFAMethod.enum';
import VerificationType from '@mayday-command/utils/enums/VerificationType.enum';

// Custom Modules
import Account from 'src/database/account.entity';
import MFAChallenge from 'src/database/mfa-challenge.entity';
import OneTimePasscodeService from 'src/otp/one-time-passcode.service';
import MFAMethodHandler from 'src/utils/interfaces/MFAMethodHandler.interface';

/** Second factor by emailed six-digit code. */
@Injectable()
export default class EmailMFAMethod implements MFAMethodHandler {
    /** This handler's method: email. */
    readonly method = MFAMethod.Email;
    /** The account's email must be verified before it can be challenged by email. */
    readonly verificationType = VerificationType.Email;

    /** The 'email' queue the code is sent on, and the one-time passcode service. */
    constructor(
        @InjectQueue('email') private emailQueue: Queue,
        private oneTimePasscode: OneTimePasscodeService
    ) {}

    /** The account's email, masked for display: its first letter, then `***@` and the domain. */
    getDestination(account: Account): string {
        const [name, domain] = account.email.split('@');

        return `${name.charAt(0)}***@${domain}`;
    }

    /** Generates a code, queues the email carrying it, and returns only its hash for the challenge to store. */
    async issue(account: Account) {
        const code = this.oneTimePasscode.generate();

        await this.emailQueue.add('mfa-code', {
            firstName: account.firstName,
            lastName: account.lastName,
            email: account.email,
            oneTimePasscode: code
        });

        return { codeHash: await this.oneTimePasscode.hash(code) };
    }

    /** Whether `input` matches the code hash stored on the challenge. */
    async verify(challenge: MFAChallenge, input: string) {
        if (!challenge.codeHash) {
            return false;
        }

        return this.oneTimePasscode.matches(challenge.codeHash, input);
    }
}
