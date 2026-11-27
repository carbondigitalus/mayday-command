// NPM Modules
import { HttpException, HttpStatus } from '@nestjs/common';

/** A 429 with an optional wait. The body carries `retryAfterSeconds` for the client, and `TooManyRequestsFilter` also
 * sends it as the standard `Retry-After` header. Used by the login and password-change lockouts and by the resend
 * waits and hourly caps on one-time codes. */
export default class TooManyRequestsException extends HttpException {
    /** @param message What the person sees.
     * @param retryAfterSeconds How long until they may try again, when it's known. */
    constructor(
        message: string,
        readonly retryAfterSeconds?: number
    ) {
        super(
            {
                message,
                statusCode: HttpStatus.TOO_MANY_REQUESTS,
                ...(retryAfterSeconds !== undefined && { retryAfterSeconds })
            },
            HttpStatus.TOO_MANY_REQUESTS
        );
    }
}
