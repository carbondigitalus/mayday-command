// NPM Modules
import { ArgumentsHost } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { QueryFailedError } from 'typeorm';

// Custom Modules
import TypeORMExceptionFilter from 'src/utils/filters/TypeORMException.filter';
import LoggerService from 'src/logger/logger.service';

jest.mock('@sentry/nestjs', () => ({
    captureException: jest.fn()
}));

describe('TypeORMExceptionFilter', () => {
    let filter: TypeORMExceptionFilter;
    let logger: { error: jest.Mock };
    let response: { status: jest.Mock; json: jest.Mock };
    let host: ArgumentsHost;

    beforeEach(() => {
        jest.clearAllMocks();
        logger = { error: jest.fn() };
        filter = new TypeORMExceptionFilter(logger as unknown as LoggerService);

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

    it('maps a known Postgres error code to its HTTP translation', () => {
        const exception = new QueryFailedError('query', [], {
            code: '23505',
            message: 'duplicate key value',
            detail: 'Key (email)=(a@b.com) already exists.'
        } as unknown as Error);

        filter.catch(exception, host);

        expect(response.status).toHaveBeenCalledWith(409);
        expect(response.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'A record with these values already exists.'
            })
        );
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalled();
    });

    it('falls back to a 500 and reports to Sentry for unmapped error codes', () => {
        const exception = new QueryFailedError('query', [], {
            code: '99999',
            message: 'unknown db error'
        } as unknown as Error);

        filter.catch(exception, host);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'An unexpected database error occurred.'
            })
        );
        expect(Sentry.captureException).toHaveBeenCalledWith(
            exception,
            expect.objectContaining({
                tags: { sqlstate: '99999' }
            })
        );
    });

    it('falls back to a 500 and reports to Sentry when no driver error code is present', () => {
        const exception = new QueryFailedError('query', [], {
            message: 'error without a code'
        } as unknown as Error);

        filter.catch(exception, host);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(Sentry.captureException).toHaveBeenCalledWith(
            exception,
            expect.objectContaining({
                tags: { sqlstate: 'unknown' }
            })
        );
    });

    it('falls back to a 500 when the exception carries no driverError at all', () => {
        // A validly-constructed QueryFailedError always has a driverError
        // (the constructor dereferences it), but the filter defensively
        // optional-chains on it anyway. Simulate that defensive path by
        // clearing driverError after construction.
        const exception = new QueryFailedError('query', [], {
            code: '23505',
            message: 'duplicate key value'
        } as unknown as Error);
        (exception as { driverError?: unknown }).driverError = undefined;

        filter.catch(exception, host);

        expect(response.status).toHaveBeenCalledWith(500);
        expect(Sentry.captureException).toHaveBeenCalledWith(
            exception,
            expect.objectContaining({
                tags: { sqlstate: 'unknown' },
                extra: { detail: undefined }
            })
        );
    });
});
