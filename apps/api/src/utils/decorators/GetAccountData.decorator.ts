// NPM Modules
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Reads a property off the request, such as `@GetAccountData('account')` for the account `JWTAccessTokenGuard`
 * signed in. With no key, it returns the whole request. */
const GetAccountData = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
    const request: Express.Request = ctx.switchToHttp().getRequest();

    if (data) {
        return (request as unknown as Record<string, unknown>)[data];
    }

    return request;
});

export default GetAccountData;
