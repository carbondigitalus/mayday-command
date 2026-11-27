// NPM Modules
import { ArgumentsHost, Catch, ExceptionFilter, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

// Custom Modules
import LoggerService from 'src/logger/logger.service';

@Catch(TokenExpiredError, JsonWebTokenError)
export default class JWTExceptionFilter implements ExceptionFilter {
    constructor(private logger: LoggerService) {}

    catch(exception: TokenExpiredError | JsonWebTokenError, host: ArgumentsHost): void {
        const logContext = 'JWTExceptionFilter';

        const httpException =
            exception instanceof TokenExpiredError
                ? new ForbiddenException('Your session has expired. Please log in again.')
                : new ForbiddenException('Invalid token.');

        this.logger.warn(`JWT ${exception.constructor.name}: ${exception.message}`, logContext);

        const response = host.switchToHttp().getResponse<Response>();
        response.status(httpException.getStatus()).json(httpException.getResponse());
    }
}
