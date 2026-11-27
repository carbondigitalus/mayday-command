// Core Modules
import { join } from 'path';

// NPM Modules
import { LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

// Custom Modules
import AppModule from './app.module';
import configureApp from './app.setup';
import './sentry/sentry.service';

/** The log levels printed: production leaves out `debug` and `verbose`, so detailed logs stay in development. Applies
 * to `LoggerService` too, since it extends Nest's `Logger`. */
const logLevels: LogLevel[] =
    process.env.NODE_ENV === 'production' ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'];

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: logLevels });
    app.setBaseViewsDir(join(__dirname, '..', 'views'));
    app.setViewEngine('pug');
    // setup cors on subdomain
    /** `COOKIE_DOMAIN` with any leading dot dropped and its dots escaped, so it matches only literally. */
    const cookieDomain = process.env.COOKIE_DOMAIN.replace(/^\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    app.enableCors({
        origin: [
            new RegExp(`^https:\\/\\/([a-z0-9-]+\\.)*${cookieDomain}$`),
            /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/
        ],
        credentials: true,
        // so the SSO can show how long a throttled client has to wait; browsers hide it from scripts otherwise
        exposedHeaders: ['Retry-After']
    });
    // validation, url prefix, response wrapper and cookie parsing
    configureApp(app);
    // listen on express app port
    await app.listen(process.env.PORT || 3000);
}
// start app
bootstrap().catch((error: Error) => {
    throw new Error(`bootstrap error: ${error}`);
});
