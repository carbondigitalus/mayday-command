// NPM Modules
import { IsNotEmpty, IsString } from 'class-validator';

/** The body of `POST /organization`. Only the name: an organization starts active, and its logo comes through the
 * logo upload. */
export default class OrganizationCreateDTO {
    /** The organization's display name. */
    @IsString()
    @IsNotEmpty()
    name: string;
}
