// NPM Modules
import { IsNotEmpty, IsString } from 'class-validator';

/** The body of `POST /verification/email/resend`. */
export default class VerificationEmailResendDTO {
    /** The encrypted token from the verification email or the register response, identifying the account. Accepted
     * even after it has lapsed. */
    @IsString()
    @IsNotEmpty()
    emailVerificationToken: string;
}
