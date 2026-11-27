// NPM Modules
import { IsNotEmpty, IsString } from 'class-validator';

// Custom Modules
import StrongPassword from 'src/utils/decorators/StrongPassword.decorator';

/** The body of `PATCH /account/password-reset`. */
export default class AccountPasswordResetDTO {
    /** The reset token from the password reset email. Sent in the body, not the URL, so request logs redact it. */
    @IsString()
    @IsNotEmpty()
    token: string;

    /** The new password. */
    @StrongPassword()
    @IsNotEmpty()
    password: string;

    /** Must match `password`. */
    @IsString()
    @IsNotEmpty()
    passwordConfirm: string;
}
