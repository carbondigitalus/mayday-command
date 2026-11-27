// NPM Modules
import { HttpStatus } from '@nestjs/common';

// Custom Modules
import TooManyRequestsException from 'src/utils/exceptions/TooManyRequests.exception';

describe('TooManyRequestsException', () => {
    it('is a 429 carrying the wait in its body when one is known', () => {
        const exception = new TooManyRequestsException('Please wait 42 seconds.', 42);

        expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(exception.retryAfterSeconds).toBe(42);
        expect(exception.getResponse()).toEqual({
            message: 'Please wait 42 seconds.',
            retryAfterSeconds: 42,
            statusCode: HttpStatus.TOO_MANY_REQUESTS
        });
    });

    it('leaves retryAfterSeconds out of the body when the wait is unknown', () => {
        const exception = new TooManyRequestsException('Please try again later.');

        expect(exception.getResponse()).toEqual({
            message: 'Please try again later.',
            statusCode: HttpStatus.TOO_MANY_REQUESTS
        });
    });
});
