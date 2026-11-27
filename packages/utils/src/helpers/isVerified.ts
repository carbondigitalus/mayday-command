// Custom Modules
import VerificationStatus from '../enums/VerificationStatus.enum';
import VerificationType from '../enums/VerificationType.enum';
import AccountVerifications from '../interfaces/AccountVerifications.interface';

/** Whether `account` holds a `Verified` record for `type` in its
 * `verifications`. Accepts any account-shaped object so the API entity and
 * the shared DTO can both use it. */
export default function isVerified(
    account: { verifications?: AccountVerifications | null } | null | undefined,
    type: VerificationType
): boolean {
    return account?.verifications?.[type]?.status === VerificationStatus.Verified;
}
