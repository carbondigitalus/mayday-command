// NPM Modules
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

// Custom Modules
import StrongPassword from 'src/utils/decorators/StrongPassword.decorator';

/** The body of `POST /account/register`. */
export default class AccountRegisterDTO {
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    /** Stored lowercase. Must not belong to another account. */
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @StrongPassword()
    password: string;

    /** Must match `password`. */
    @IsString()
    passwordConfirm: string;
}
