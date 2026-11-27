// NPM Modules
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';

// Custom Modules
import TooManyRequestsException from 'src/utils/exceptions/TooManyRequests.exception';

/** Answers a `TooManyRequestsException` with its 429 body, plus a `Retry-After` header when the wait is known, the same
 * header the rate limiter sends and `main.ts` already lets browsers read. */
@Catch(TooManyRequestsException)
export default class TooManyRequestsFilter implements ExceptionFilter {
    /** Writes the status, the `Retry-After` header when there is one, and the body. */
    catch(exception: TooManyRequestsException, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>();

        if (exception.retryAfterSeconds !== undefined) {
            response.setHeader('Retry-After', String(exception.retryAfterSeconds));
        }

        response.status(exception.getStatus()).json(exception.getResponse());
    }
}
