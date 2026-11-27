// NPM Modules
import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

// Custom Modules
import Account from 'src/database/account.entity';
import allowUnverifiedEmailKey from 'src/utils/constants/allow-unverified-email';
import { universalVerificationTypes } from '@mayday-command/utils/constants/verification.constants';
import isVerified from '@mayday-command/utils/helpers/isVerified';

/** Authenticates the access-token cookie and puts the account on `req.account`, then rejects accounts that
 * haven't completed every {@link universalVerificationTypes} entry unless
 * the route opts out with `@AllowUnverifiedEmail()`. Enforcing it here
 * rather than per controller means no protected route can be reached by an
 * unverified account calling the API directly. */
@Injectable()
export default class JWTAccessTokenGuard extends AuthGuard('jwt-access-token') {
    constructor(private reflector: Reflector) {
        super({ property: 'account' });
    }

    handleRequest<TAccount = Account>(
        err: unknown,
        account: TAccount,
        info: unknown,
        context: ExecutionContext,
        status?: unknown
    ): TAccount {
        const authenticatedAccount: TAccount = super.handleRequest(err, account, info, context, status);

        const allowsUnverified = this.reflector.getAllAndOverride<boolean | undefined>(allowUnverifiedEmailKey, [
            context.getHandler(),
            context.getClass()
        ]);

        if (!allowsUnverified) {
            const unmet = universalVerificationTypes.find((type) => !isVerified(authenticatedAccount as Account, type));

            if (unmet) {
                throw new ForbiddenException(`Verification required: ${unmet}.`);
            }
        }

        return authenticatedAccount;
    }
}
