// NPM Modules
import { IsNotEmpty, IsString } from 'class-validator';

// Custom Modules
import StrongPassword from 'src/utils/decorators/StrongPassword.decorator';

/** The body of `PATCH /account/password-change`. */
export default class AccountPasswordChangeDTO {
    /** Proves the person at the keyboard knows the password, not just that a session is open. Not held to the
     * strength rule, so an account with an older, weaker password can still change it. */
    @IsString()
    @IsNotEmpty()
    currentPassword: string;

    /** The new password. Must differ from the current one. */
    @StrongPassword()
    @IsNotEmpty()
    password: string;

    /** Must match `password`. */
    @IsString()
    @IsNotEmpty()
    passwordConfirm: string;
}
