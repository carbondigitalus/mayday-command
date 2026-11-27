// NPM Modules
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** The body of `POST /account/login`. */
export default class AccountLoginDTO {
    /** Matched case-insensitively. */
    @IsEmail()
    @IsNotEmpty()
    email: string;

    /** Not held to the strength rule, so an account with an older, weaker password can still sign in. */
    @IsString()
    @IsNotEmpty()
    password: string;
}
