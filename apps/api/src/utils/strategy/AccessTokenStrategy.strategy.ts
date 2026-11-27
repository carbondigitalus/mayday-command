// NPM Modules
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';

// Custom Modules
import Account from 'src/database/account.entity';
import TokenTypes from 'src/utils/enums/TokenTypes.enum';
import { decryptToken } from 'src/utils/helpers/tokenCipher';
import TokenData from 'src/utils/interfaces/TokenData.interface';

@Injectable()
export default class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt-access-token') {
    constructor(
        @InjectRepository(Account)
        private accountRepository: Repository<Account>
    ) {
        super({
            /** The session cookie's token, decrypted back to the signed JWT. `null` when there's no cookie or it won't
             * decrypt, which passport-jwt answers with a 401. */
            jwtFromRequest: (request: Request) => {
                const cookie = request.cookies[process.env.COOKIE_NAME] as string | undefined;

                return cookie ? decryptToken(cookie) : null;
            },
            secretOrKey: process.env.JWT_TOKEN_ACCESS_SECRET
        });
    }

    /** Returns the session's account. Refuses a token of another type, a missing or deactivated account, and a token
     * issued before the account's password last changed, so changing or resetting the password ends every other
     * session. `iat` is in whole seconds, so `passwordChangedAt` is truncated to seconds too; otherwise the cookie
     * issued in the same second as the change would look older than it. */
    async validate(payload: TokenData) {
        if (payload.tokenType !== TokenTypes.Access) {
            throw new UnauthorizedException('Invalid token type.');
        }

        const account = await this.accountRepository.findOne({
            where: { id: payload.sub }
        });

        if (!account) {
            throw new UnauthorizedException('Invalid session.');
        }

        if (!account.isActive) {
            throw new UnauthorizedException('Account is deactivated.');
        }

        if (
            account.passwordChangedAt &&
            payload.iat < Math.floor(new Date(account.passwordChangedAt).getTime() / 1000)
        ) {
            throw new UnauthorizedException('Your password was changed. Please log in again.');
        }

        return account;
    }
}
