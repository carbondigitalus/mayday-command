// NPM Modules
import { IsNotEmpty, IsString } from 'class-validator';

/** The body of the token routes, `POST /invitation/accept`, `/decline` and `/preview`: the encrypted invitation token
 * from the invite email. Sent in the body, never the URL, so request logs can't record it. */
export default class InvitationTokenDTO {
    @IsString()
    @IsNotEmpty()
    invitationToken: string;
}
