// NPM Modules
import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * The password rule for the `account` table, defined once: 12 to 60 characters, with at least one
 * uppercase letter, one lowercase letter, one number and one of `!@#$%^&*()-_+.`. It is applied to the
 * entity and to every DTO that takes a new password (register, reset, change), so the API enforces what
 * the front-end forms already check. Login deliberately does not use it, so an account with an older,
 * weaker password can still sign in and change it.
 */
const StrongPassword = () =>
    applyDecorators(
        IsString(),
        MinLength(12, { message: 'Passwords can not be less than 12 characters.' }),
        MaxLength(60, { message: 'Passwords can not exceed 60 characters.' }),
        Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+.]).{12,60}$/, {
            message:
                'Password Strength Requirements: 1 uppercase, 1 lowercase, 1 number and 1 special character. Authorized special characters are !@#$%^&*()-_+.'
        })
    );

export default StrongPassword;
