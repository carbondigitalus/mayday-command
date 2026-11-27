// NPM Modules
import { IsNotEmpty, IsNumberString, IsString, Length } from 'class-validator';

/** The body of `POST /verification/email/confirm`. */
export default class VerificationEmailConfirmDTO {
    /** The encrypted token from the verification email or the register response, identifying the account. */
    @IsString()
    @IsNotEmpty()
    emailVerificationToken: string;

    /** The six-digit code from the verification email. */
    @IsNumberString({ no_symbols: true })
    @Length(6, 6)
    oneTimePasscode: string;
}
