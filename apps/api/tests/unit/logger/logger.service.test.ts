// NPM Modules
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import chalk from 'chalk';

// Custom Modules
import LoggerService from 'src/logger/logger.service';

describe('LoggerService', () => {
    let service: LoggerService;
    let debugSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let verboseSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [LoggerService]
        }).compile();
        service = module.get(LoggerService);
        debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
        warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        verboseSpy = jest.spyOn(Logger.prototype, 'verbose').mockImplementation();
        logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('debug', () => {
        it('logs the message with the default prefix when no context is given', () => {
            service.debug('hello world');

            expect(debugSpy).toHaveBeenCalledTimes(1);
            expect(debugSpy.mock.calls[0][0]).toContain('[Logger] ');
            expect(debugSpy.mock.calls[0][0]).toContain('hello world');
        });

        it('logs the message with a context-scoped prefix when context is given', () => {
            service.debug('hello world', 'MyContext');

            expect(debugSpy.mock.calls[0][0]).toContain('[Logger-MyContext]: ');
            expect(debugSpy.mock.calls[0][0]).toContain('hello world');
        });

        it('does not append a data segment when no data is provided', () => {
            service.debug('hello world', 'MyContext');

            expect(debugSpy.mock.calls[0][0]).not.toContain('Data:');
        });

        it('redacts every sensitive key the API uses, and leaves other fields alone', () => {
            const secrets = {
                accessToken: 's1',
                codeHash: 's2',
                currentPassword: 's3',
                emailVerificationToken: 's4',
                invitationToken: 's5',
                mfaChallengeToken: 's7',
                mfaToken: 's8',
                oneTimePasscode: 's9',
                password: 's10',
                passwordConfirm: 's11',
                passwordResetToken: 's12',
                token: 's13'
            };

            service.debug('user action', 'Ctx', { ...secrets, name: 'Bob' });

            const out = debugSpy.mock.calls[0][0] as string;
            Object.keys(secrets).forEach((key) => expect(out).toContain(`"${key}":"[Redacted]"`));
            expect(out).not.toMatch(/"s\d+"/);
            expect(out).toContain('"name":"Bob"');
        });

        it('matches sensitive keys without regard to letter case', () => {
            service.debug('user action', 'Ctx', { Password: 'a', MFATOKEN: 'b', OneTimePasscode: 'c' });

            const out = debugSpy.mock.calls[0][0] as string;
            expect(out).toContain('"Password":"[Redacted]"');
            expect(out).toContain('"MFATOKEN":"[Redacted]"');
            expect(out).toContain('"OneTimePasscode":"[Redacted]"');
        });

        it('no longer treats keys the API does not use as sensitive', () => {
            service.debug('user action', 'Ctx', { cookie: 'c', patientAccessToken: 'p', revalidateToken: 'r' });

            const out = debugSpy.mock.calls[0][0] as string;
            expect(out).toContain('"cookie":"c"');
            expect(out).toContain('"patientAccessToken":"p"');
            expect(out).toContain('"revalidateToken":"r"');
        });

        it('redacts every password in a stringified password-change body, as the HTTP interceptor sends it', () => {
            service.debug(
                'HTTP PATCH /account/password-change',
                'HTTP',
                JSON.stringify({ currentPassword: 'old-secret', password: 'new-secret', passwordConfirm: 'new-secret' })
            );

            const out = debugSpy.mock.calls[0][0];
            expect(out).toContain('"currentPassword":"[Redacted]"');
            expect(out).toContain('"password":"[Redacted]"');
            expect(out).toContain('"passwordConfirm":"[Redacted]"');
            expect(out).not.toContain('secret');
        });

        it('parses a stringified JSON payload and redacts sensitive keys', () => {
            service.debug('user action', 'Ctx', JSON.stringify({ token: 'abc', id: 1 }));

            const out = debugSpy.mock.calls[0][0];
            expect(out).toContain('"token":"[Redacted]"');
            expect(out).toContain('"id":1');
        });

        it('redacts sensitive keys nested inside sub-objects', () => {
            service.debug('user action', 'Ctx', { account: { password: 'nested-secret', name: 'Bob' } });

            const out = debugSpy.mock.calls[0][0] as string;
            expect(out).not.toContain('nested-secret');
            expect(out).toContain('"account":{"password":"[Redacted]","name":"Bob"}');
        });

        it('redacts sensitive keys inside arrays', () => {
            service.debug('user action', 'Ctx', [{ password: 'in-array' }, { token: 'also-in-array' }]);

            const out = debugSpy.mock.calls[0][0] as string;
            expect(out).not.toContain('in-array');
            expect(out).toContain('[{"password":"[Redacted]"},{"token":"[Redacted]"}]');
        });

        it('logs a Date as itself instead of taking it apart', () => {
            const createdOn = new Date('2026-11-27T12:00:00.000Z');

            service.debug('user action', 'Ctx', { createdOn });

            expect(debugSpy.mock.calls[0][0]).toContain('"createdOn":"2026-11-27T12:00:00.000Z"');
        });

        it('returns primitive data payloads untouched (non-object, non-string)', () => {
            service.debug('count changed', 'Ctx', 42);

            const out = debugSpy.mock.calls[0][0];
            expect(out).toContain('Data: 42');
        });

        it('returns falsy data payloads without a data segment', () => {
            service.debug('nothing here', 'Ctx', 0);

            const out = debugSpy.mock.calls[0][0];
            expect(out).not.toContain('Data:');
        });

        it('passes through a falsy value directly when sanitizeData is invoked with one', () => {
            /** formatMessage already guards against falsy `data` before calling sanitizeData, so this branch is only
             * reachable via a direct call. */
            const typedService = service as unknown as {
                sanitizeData: (d: unknown) => unknown;
            };
            const sanitizeData = (d: unknown): unknown => typedService.sanitizeData(d);

            expect(sanitizeData(0)).toBe(0);
            expect(sanitizeData('')).toBe('');
            expect(sanitizeData(null)).toBe(null);
        });

        it('formats a non-string message as-is without attempting URL sanitization', () => {
            service.debug(12345, 'Ctx');

            expect(debugSpy.mock.calls[0][0]).toContain('12345');
        });

        it('keeps a non-JSON string payload as-is, without writing an extra entry about it', () => {
            service.debug('bad payload', 'Ctx', 'not-json{');

            expect(debugSpy).toHaveBeenCalledTimes(1);
            expect(debugSpy.mock.calls[0][0]).toContain('not-json{');
        });

        it('sanitizes a URL embedded in the log message', () => {
            service.debug(`Calling https://example.com/path?token=secret&keep=me`, 'Ctx');

            const out = debugSpy.mock.calls[0][0];
            expect(out).toContain('token=%5BRedacted%5D');
            expect(out).toContain('keep=me');
            expect(out).not.toContain('token=secret');
        });

        it('sanitizes the query string of a bare request path, as the HTTP interceptor logs it', () => {
            service.debug('HTTP GET /invitation/accept?token=secret&page=2', 'HTTP');

            const out = debugSpy.mock.calls[0][0] as string;
            expect(out).toContain('/invitation/accept?token=%5BRedacted%5D&page=2');
            expect(out).not.toContain('secret');
        });

        it('sanitizes every URL in a message, not just the first', () => {
            service.debug('from https://a.example/x?token=one to /y?token=two', 'Ctx');

            const out = debugSpy.mock.calls[0][0] as string;
            expect(out).not.toContain('one');
            expect(out).not.toContain('two');
            expect(out).toContain('https://a.example/x?token=%5BRedacted%5D');
            expect(out).toContain('/y?token=%5BRedacted%5D');
        });

        it('leaves a path without a query string as it is', () => {
            service.debug('HTTP GET /account/admin', 'HTTP');

            expect(debugSpy.mock.calls[0][0]).toContain('HTTP GET /account/admin');
        });

        it('leaves a message without a URL untouched', () => {
            service.debug('no url present here', 'Ctx');

            expect(debugSpy.mock.calls[0][0]).toContain('no url present here');
        });

        it('returns the original message when the matched URL fails to parse', () => {
            const message = 'Check this http://[::1 broken';
            service.debug(message, 'Ctx');

            expect(debugSpy).toHaveBeenCalledTimes(1);
            expect(debugSpy.mock.calls[0][0]).toContain('Check this http://[::1 broken');
        });
    });

    describe('error', () => {
        it('logs the formatted message via super.error', () => {
            service.error('boom');

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy.mock.calls[0][0]).toContain('boom');
        });

        it('also logs the stack trace in red when a trace is provided', () => {
            service.error('boom', 'stack-trace-here');

            expect(errorSpy).toHaveBeenCalledTimes(2);
            expect(errorSpy.mock.calls[1][0]).toContain('stack-trace-here');
        });

        it('does not log a second time when no trace is provided', () => {
            service.error('boom', undefined, 'Ctx');

            expect(errorSpy).toHaveBeenCalledTimes(1);
        });

        it('redacts sensitive data when provided alongside the error', () => {
            service.error('boom', undefined, 'Ctx', { token: 'secret' });

            expect(errorSpy.mock.calls[0][0]).toContain('"token":"[Redacted]"');
        });
    });

    describe('warn', () => {
        it('includes redacted data, like every other level', () => {
            service.warn('careful', 'Ctx', { accountID: 'acc-1', token: 'secret' });

            const out = warnSpy.mock.calls[0][0] as string;
            expect(out).toContain('"accountID":"acc-1"');
            expect(out).toContain('"token":"[Redacted]"');
        });

        it('logs the formatted message via super.warn', () => {
            service.warn('careful', 'Ctx');

            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls[0][0]).toContain('careful');
            expect(warnSpy.mock.calls[0][0]).toContain('[Logger-Ctx]: ');
        });
    });

    describe('verbose', () => {
        it('logs under its own level, in every environment, so the level filter in main.ts decides', () => {
            service.verbose('extra detail', 'Ctx');

            expect(verboseSpy).toHaveBeenCalledTimes(1);
            expect(debugSpy).not.toHaveBeenCalled();
        });
    });

    describe('log', () => {
        it('logs under its own level, in every environment, instead of as debug', () => {
            service.log('normal log', 'Ctx');

            expect(logSpy).toHaveBeenCalledTimes(1);
            expect(debugSpy).not.toHaveBeenCalled();
        });
    });

    describe('getColorFunction (via public log levels)', () => {
        it('uses a color function for every known level without throwing', () => {
            expect(() => service.debug('a')).not.toThrow();
            expect(() => service.error('b')).not.toThrow();
            expect(() => service.warn('c')).not.toThrow();
            process.env.NODE_ENV = 'production';
            expect(() => service.verbose('d')).not.toThrow();
            expect(() => service.log('e')).not.toThrow();
            process.env.NODE_ENV = 'test';
        });

        it('falls back to the default (white) color function for an unknown level', () => {
            /** getColorFunction is private; invoked directly to exercise the otherwise-unreachable default branch
             * (formatMessage is only ever called internally with known levels). */
            const colorFn = (
                service as unknown as {
                    getColorFunction: (level: string) => (text: string) => string;
                }
            ).getColorFunction('unknown-level');

            /** Compared against chalk's own output (rather than a hardcoded plain string) since whether chalk actually
             * emits ANSI codes depends on the runtime's color-support detection. */
            expect(colorFn('plain')).toBe(chalk.white('plain'));
        });
    });
});
