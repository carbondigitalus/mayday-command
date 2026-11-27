import VerificationType from '../enums/VerificationType.enum';

/** Verification types every account must satisfy. Enforced by the API's JWT guard and mirrored as the Portal's
 * onboarding steps — append a type here (e.g. Phone) to require it. */
export const universalVerificationTypes: VerificationType[] = [VerificationType.Email];
