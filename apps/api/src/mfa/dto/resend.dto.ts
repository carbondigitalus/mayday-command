// NPM Modules
import { IsNotEmpty, IsString } from 'class-validator';

/** The body of `POST /mfa/resend`. */
export default class MFAResendDTO {
    /** The encrypted challenge token login returned. */
    @IsString()
    @IsNotEmpty()
    mfaToken: string;
}
