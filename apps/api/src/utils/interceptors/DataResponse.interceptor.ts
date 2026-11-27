// NPM Modules
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

// Custom Modules
import LoggerService from 'src/logger/logger.service';

@Injectable()
export default class DataResponse implements NestInterceptor {
    constructor(private readonly logger: LoggerService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        // Extract request information (HTTP-specific)
        const request: Request = context.switchToHttp().getRequest<Request>();
        const method: string = request.method;
        const url: string = request.originalUrl || request.url;

        return next.handle().pipe(
            finalize(() => {
                this.logger.log(`HTTP ${method} ${url}`, 'HTTP', JSON.stringify(request.body ?? {}));
            }),
            map((data: unknown) => ({ data }))
        );
    }
}
