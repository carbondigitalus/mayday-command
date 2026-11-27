// NPM Modules
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

// Custom Modules
import DataResponse from 'src/utils/interceptors/DataResponse.interceptor';
import LoggerService from 'src/logger/logger.service';

describe('DataResponse', () => {
    let interceptor: DataResponse;
    let logger: { log: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();
        logger = { log: jest.fn() };
        interceptor = new DataResponse(logger as unknown as LoggerService);
    });

    const buildContext = (request: Record<string, unknown>) =>
        ({
            switchToHttp: () => ({
                getRequest: () => request
            })
        }) as unknown as ExecutionContext;

    const buildCallHandler = (value: unknown): CallHandler => ({
        handle: () => of(value)
    });

    it('wraps the handler result in a data envelope', () => {
        const request = {
            method: 'GET',
            originalUrl: '/account',
            body: {}
        };
        const context = buildContext(request);
        const callHandler = buildCallHandler({ id: '1' });

        let received: unknown;
        interceptor.intercept(context, callHandler).subscribe((result) => {
            received = result;
        });

        expect(received).toEqual({ data: { id: '1' } });
    });

    it('logs the request method and URL when the stream finalizes', () => {
        const request = {
            method: 'POST',
            originalUrl: '/account/login',
            body: { email: 'a@b.com' }
        };
        const context = buildContext(request);
        const callHandler = buildCallHandler('ok');

        interceptor.intercept(context, callHandler).subscribe();

        expect(logger.log).toHaveBeenCalledWith('HTTP POST /account/login', '', JSON.stringify({ email: 'a@b.com' }));
    });

    it('falls back to request.url when originalUrl is missing', () => {
        const request = { method: 'GET', url: '/fallback' };
        const context = buildContext(request);
        const callHandler = buildCallHandler('ok');

        interceptor.intercept(context, callHandler).subscribe();

        expect(logger.log).toHaveBeenCalledWith('HTTP GET /fallback', '', JSON.stringify({}));
    });
});
