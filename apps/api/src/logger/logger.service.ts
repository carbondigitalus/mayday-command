// Core Modules
import { URL } from 'url';

// NPM Modules
import { Injectable, Logger } from '@nestjs/common';
import chalk from 'chalk';

/** The API's one logger. It extends Nest's `Logger`, so the level filter in `main.ts` applies to it, and redacts
 * secrets from every message and `data` value before anything is printed. Output goes to the console only. */
@Injectable()
export default class LoggerService extends Logger {
    /** Keys whose values are never logged, at any depth and in any letter case. Each is a request body field, stored
     * column or token response in this API that holds a password, token, passcode or hash. */
    private sensitiveDataKeys = new Set(
        [
            'accessToken',
            'codeHash',
            'currentPassword',
            'emailVerificationToken',
            'invitationToken',
            'mfaChallengeToken',
            'mfaToken',
            'oneTimePasscode',
            'password',
            'passwordConfirm',
            'passwordResetToken',
            'token'
        ].map((key) => key.toLowerCase())
    );

    /** Query parameters whose values are never logged, in full URLs and bare request paths alike. */
    private sensitiveQueryParams = ['token'];

    /** Logs detail for development. Left out in production. */
    debug(message: unknown, context?: string, data?: unknown): void {
        super.debug(this.formatMessage('debug', message, context, data));
    }

    /** Logs a failure, then its stack `trace` on its own line when one is given. */
    error(message: unknown, trace?: string, context?: string, data?: unknown): void {
        super.error(this.formatMessage('error', message, context, data));

        if (trace) {
            super.error(chalk.red(trace));
        }
    }

    /** Builds the printed line: the context prefix, the message with URL secrets redacted, then the redacted `data` as
     * JSON, all in the level's color. */
    private formatMessage(level: string, message: unknown, context?: string, data?: unknown): string {
        const prefix = context ? `[Logger-${context}]: ` : '[Logger] ';
        const colorFn = this.getColorFunction(level);

        const sanitizedMessage = typeof message === 'string' ? this.sanitizeURL(message) : (message as string);

        const mainMessage = colorFn(`${prefix}${sanitizedMessage}`);

        const redactedData = data ? this.sanitizeData(data) : null;
        const dataMessage = redactedData ? colorFn(`Data: ${JSON.stringify(redactedData)}`) : '';

        return data ? `${mainMessage} ${dataMessage}` : mainMessage;
    }

    /** The color for a level's lines. chalk leaves color out when the output isn't a terminal, as on most hosts. */
    private getColorFunction(level: string): (text: string) => string {
        switch (level) {
            case 'error':
                return chalk.red;
            case 'warn':
                return chalk.yellow;
            case 'log':
                return chalk.blue;
            case 'debug':
                return chalk.magenta;
            case 'verbose':
                return chalk.cyan;
            default:
                return chalk.white;
        }
    }

    /** Whether `value` is a plain object, as JSON produces. A `Date` or other class instance isn't, so it's logged as
     * itself instead of being taken apart. */
    private isRecord(value: unknown): value is Record<string, unknown> {
        if (typeof value !== 'object' || value === null) {
            return false;
        }

        const prototype: unknown = Object.getPrototypeOf(value);

        return prototype === Object.prototype || prototype === null;
    }

    /** Logs a normal event. Printed in every environment. */
    log(message: unknown, context?: string, data?: unknown): void {
        super.log(this.formatMessage('log', message, context, data));
    }

    /** Copies `value`, replacing the value of every {@link sensitiveDataKeys} key with `[Redacted]`, through nested
     * objects and arrays. */
    private redact(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((item) => this.redact(item));
        }

        if (!this.isRecord(value)) {
            return value;
        }

        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                this.sensitiveDataKeys.has(key.toLowerCase()) ? '[Redacted]' : this.redact(item)
            ])
        );
    }

    /** Redacts `data`, first parsing it when it's a JSON string, as the request logger sends request bodies. A string
     * that isn't JSON is returned as it is. */
    private sanitizeData(data: unknown): unknown {
        if (!data) {
            return data;
        }

        let parsedData: unknown = data;

        if (typeof data === 'string') {
            try {
                parsedData = JSON.parse(data) as unknown;
            } catch {
                return data;
            }
        }

        return this.redact(parsedData);
    }

    /** Replaces the query values in {@link sensitiveQueryParams} with `[Redacted]` in every URL in `message`: full
     * `http(s)://` addresses, and bare paths with a query string, such as the request line `HTTP GET /path?token=…`. */
    private sanitizeURL(message: string): string {
        return message.replace(/https?:\/\/\S+|\/\S*\?\S+/g, (match) => {
            try {
                const isAbsolute = /^https?:\/\//.test(match);
                const parsedURL = new URL(match, 'http://relative.invalid');

                this.sensitiveQueryParams.forEach((key) => {
                    if (parsedURL.searchParams.has(key)) {
                        parsedURL.searchParams.set(key, '[Redacted]');
                    }
                });

                const query = parsedURL.searchParams.toString();

                return `${isAbsolute ? parsedURL.origin : ''}${parsedURL.pathname}${query ? `?${query}` : ''}`;
            } catch {
                return match;
            }
        });
    }

    /** Logs the finest detail. Left out in production. */
    verbose(message: unknown, context?: string, data?: unknown): void {
        super.verbose(this.formatMessage('verbose', message, context, data));
    }

    /** Logs something unexpected that didn't stop the request. */
    warn(message: unknown, context?: string, data?: unknown): void {
        super.warn(this.formatMessage('warn', message, context, data));
    }
}
