// NPM Modules
import { IsNotEmpty, IsString } from 'class-validator';

/** The body of `PATCH /account/update`. Only the names can be changed here. */
export default class AccountUpdateDTO {
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;
}
