// NPM Modules
import { IsEmail, IsNotEmpty } from 'class-validator';

/** The body of `POST /account/password-forgot`. */
export default class AccountPasswordForgotDTO {
    /** Where the reset link goes, if an account has this email. Matched case-insensitively. */
    @IsEmail()
    @IsNotEmpty()
    email: string;
}
