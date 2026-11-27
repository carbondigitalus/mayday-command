// NPM Modules
import { ArgumentsHost } from '@nestjs/common';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

// Custom Modules
import JWTExceptionFilter from 'src/utils/filters/JWTException.filter';
import LoggerService from 'src/logger/logger.service';

describe('JWTExceptionFilter', () => {
    let filter: JWTExceptionFilter;
    let logger: { warn: jest.Mock };
    let response: { status: jest.Mock; json: jest.Mock };
    let host: ArgumentsHost;

    beforeEach(() => {
        jest.clearAllMocks();
        logger = { warn: jest.fn() };
        filter = new JWTExceptionFilter(logger as unknown as LoggerService);

        response = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        host = {
            switchToHttp: () => ({
                getResponse: () => response
            })
        } as unknown as ArgumentsHost;
    });

    it('maps TokenExpiredError to a 403 session-expired response', () => {
        const exception = new TokenExpiredError('jwt expired', new Date());

        filter.catch(exception, host);

        expect(response.status).toHaveBeenCalledWith(403);
        expect(response.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Your session has expired. Please log in again.'
            })
        );
        expect(logger.warn).toHaveBeenCalled();
    });

    it('maps JsonWebTokenError to a 403 invalid-token response', () => {
        const exception = new JsonWebTokenError('invalid signature');

        filter.catch(exception, host);

        expect(response.status).toHaveBeenCalledWith(403);
        expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token.' }));
        expect(logger.warn).toHaveBeenCalled();
    });
});
