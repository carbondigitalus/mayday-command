// Shared Modules
import MFAMethod from '@mayday-command/utils/enums/MFAMethod.enum';
import VerificationType from '@mayday-command/utils/enums/VerificationType.enum';

// Custom Modules
import Account from 'src/database/account.entity';
import MFAChallenge from 'src/database/mfa-challenge.entity';

/** One way of proving a login: email today, an authenticator app or text
 * later. `MFAService` is method-agnostic and only ever talks to this contract,
 * so a new method is a new class implementing it, registered in `MFAModule`. */
export default interface MFAMethodHandler {
    /** Which method this handler implements. */
    method: MFAMethod;

    /** The verification the account must already hold before this method can
     * be used (a channel has to be proven to be the user's before it can
     * challenge them). */
    verificationType: VerificationType;

    /** Where the challenge goes, masked for display ("j***@example.com"). */
    getDestination(account: Account): string;

    /** Delivers a fresh challenge to the user, and returns whatever has to be
     * stored to check the answer later: the hash of the code that was sent, or
     * null for a method with no stored code. */
    issue(account: Account): Promise<{ codeHash: string | null }>;

    /** Whether `input` is the right answer to `challenge`. */
    verify(challenge: MFAChallenge, input: string): Promise<boolean>;
}
