// NPM Modules
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

// Custom Modules
import LoggerService from './logger/logger.service';
import DataResponse from './utils/interceptors/DataResponse.interceptor';

/**
 * The request pipeline every environment shares: DTO validation, the `v1` URL
 * prefix, the `{ data }` response wrapper with its HTTP logging, and cookie
 * parsing, plus which proxy to trust for the client IP (the session lives in a cookie). Lives apart from `main.ts` so the
 * e2e tests run through exactly the same setup as the real server.
 */
export default function configureApp(app: NestExpressApplication): void {
    // Railway puts two addresses on X-Forwarded-For: the client, then one of its own hops that varies from request
    // to request. Trusting two lets Express skip past both to the client. Trusting one would pick the hop, giving
    // each request a different rate-limit bucket. Express counts from the right, so a spoofed leading entry is ignored.
    app.set('trust proxy', 2);
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true
        })
    );
    // setup global response wrapper for "data", and globally HTTP logs
    app.useGlobalInterceptors(new DataResponse(app.get(LoggerService)));
    // setup global use of cookies
    app.use(cookieParser());
}
