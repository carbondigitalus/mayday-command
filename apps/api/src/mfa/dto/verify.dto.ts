// NPM Modules
import { IsNotEmpty, IsNumberString, IsString, Length } from 'class-validator';

/** The body of `POST /mfa/verify`. */
export default class MFAVerifyDTO {
    /** The encrypted challenge token login returned. */
    @IsString()
    @IsNotEmpty()
    mfaToken: string;

    /** The six-digit code that was sent. */
    @IsNumberString({ no_symbols: true })
    @Length(6, 6)
    oneTimePasscode: string;
}
