// NPM Modules
import { ArgumentsHost } from '@nestjs/common';

// Custom Modules
import TooManyRequestsException from 'src/utils/exceptions/TooManyRequests.exception';
import TooManyRequestsFilter from 'src/utils/filters/TooManyRequests.filter';

describe('TooManyRequestsFilter', () => {
    const filter = new TooManyRequestsFilter();
    let response: { json: jest.Mock; setHeader: jest.Mock; status: jest.Mock };

    const buildHost = () => ({ switchToHttp: () => ({ getResponse: () => response }) }) as unknown as ArgumentsHost;

    beforeEach(() => {
        response = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() };
        response.status.mockReturnValue(response);
    });

    it('sends the Retry-After header and the 429 body when the wait is known', () => {
        const exception = new TooManyRequestsException('Please wait 42 seconds.', 42);

        filter.catch(exception, buildHost());

        expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
        expect(response.status).toHaveBeenCalledWith(429);
        expect(response.json).toHaveBeenCalledWith(exception.getResponse());
    });

    it('sends no Retry-After header when the wait is unknown', () => {
        filter.catch(new TooManyRequestsException('Please try again later.'), buildHost());

        expect(response.setHeader).not.toHaveBeenCalled();
        expect(response.status).toHaveBeenCalledWith(429);
    });
});
