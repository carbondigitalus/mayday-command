// NPM Modules
import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CookieOptions, Response } from 'express';
import { SignOptions, TokenExpiredError } from 'jsonwebtoken';

// Custom Modules
import Account from 'src/database/account.entity';
import LoggerService from 'src/logger/logger.service';
import TokenTypes from 'src/utils/enums/TokenTypes.enum';
import { decryptToken, encryptToken } from 'src/utils/helpers/tokenCipher';
import EmailVerificationTokenData from 'src/utils/interfaces/EmailVerificationTokenData.interface';
import EmailVerificationTokenType from 'src/utils/interfaces/EmailVerificationTokenType.interface';
import InvitationTokenType from 'src/utils/interfaces/InvitationTokenType.interface';
import LoginTokenType from 'src/utils/interfaces/LoginTokenType.interface';
import MFAChallengeTokenData from 'src/utils/interfaces/MFAChallengeTokenData.interface';
import MFAChallengeTokenType from 'src/utils/interfaces/MFAChallengeTokenType.interface';
import PasswordResetTokenType from 'src/utils/interfaces/PasswordResetTokenType.interface';
import TokenData from 'src/utils/interfaces/TokenData.interface';

/** Signs and verifies the API's JWTs, one secret and `tokenType` per purpose, and sets and clears the login cookie.
 * Every token is encrypted after signing, so what leaves the API can't be read in a JWT decoder, and decrypted before
 * it is verified. */
@Injectable()
export default class AuthService {
    /** The JWT service, plus the logger. */
    constructor(
        private jwt: JwtService,
        private logger: LoggerService
    ) {}

    /** Signs a session token for `account` and sets it as the httpOnly login cookie, expiring when the token does.
     * The token travels only in the cookie, so a script on the page can never read it. */
    async createCookieLogin(account: Account, res: Response) {
        const logContext = 'AuthService-createCookieLogin';

        const { accessToken, accessTokenExpires } = await this.generateTokenLogin(account.id);

        res.cookie(process.env.COOKIE_NAME, accessToken, { ...this.getCookieOptions(), expires: accessTokenExpires });

        this.logger.log(`Login cookie set for account ${account.email}`, logContext, { accountID: account.id });

        return { status: 'success' };
    }

    /** Clears the login cookie. An httpOnly cookie can only be removed by the server, with the same options it was
     * set with. */
    createCookieLogout(res: Response) {
        res.clearCookie(process.env.COOKIE_NAME, this.getCookieOptions());

        return { status: 'success' };
    }

    /** Decodes an email verification token. `ignoreExpiration` still checks the signature and token type; it lets
     * the resend route identify the account behind a lapsed link so the user can be sent a fresh one. */
    async decodeTokenEmailVerify(token: string, ignoreExpiration = false): Promise<EmailVerificationTokenData> {
        return this.verifyToken<EmailVerificationTokenData>(token, 'AuthService-decodeTokenEmailVerify', {
            expiredMessage: 'Your email verification session has expired. Please request a new one.',
            ignoreExpiration,
            secret: process.env.JWT_TOKEN_EMAIL_VERIFY_SECRET,
            tokenType: TokenTypes.EmailVerify
        });
    }

    /** Decodes an invitation token. */
    async decodeTokenInvitation(token: string): Promise<TokenData> {
        return this.verifyToken<TokenData>(token, 'AuthService-decodeTokenInvitation', {
            expiredMessage: 'This invitation has expired. Please request a new one.',
            secret: process.env.JWT_TOKEN_INVITATION_SECRET,
            tokenType: TokenTypes.Invitation
        });
    }

    /** Identifies the pending login 2FA challenge a request belongs to. It carries no session: all it can do is be
     * exchanged for one by passing the code, so a stolen or expired token gets an attacker nothing on its own. */
    async decodeTokenMFAChallenge(token: string): Promise<MFAChallengeTokenData> {
        return this.verifyToken<MFAChallengeTokenData>(token, 'AuthService-decodeTokenMFAChallenge', {
            expiredMessage: 'Your login session has expired. Please log in again.',
            secret: process.env.JWT_TOKEN_MFA_CHALLENGE_SECRET,
            tokenType: TokenTypes.MFAChallenge
        });
    }

    /** Decodes a password reset token from the emailed link. */
    async decodeTokenPasswordReset(token: string): Promise<TokenData> {
        return this.verifyToken<TokenData>(token, 'AuthService-decodeTokenPasswordReset', {
            expiredMessage: 'This reset link has expired. Try forgot password again.',
            secret: process.env.JWT_TOKEN_PASSWORD_RESET_SECRET,
            tokenType: TokenTypes.PasswordReset
        });
    }

    /** Signs the token that identifies an account on the email verification page. */
    async generateTokenEmailVerify(accountID: string, email: string): Promise<EmailVerificationTokenType> {
        const logContext = 'AuthService-generateTokenEmailVerify';

        const payload = {
            sub: accountID,
            email: email,
            tokenType: TokenTypes.EmailVerify
        };

        const emailVerificationToken = await this.jwt.signAsync(payload, {
            expiresIn: process.env.JWT_TOKEN_EMAIL_VERIFY_EXPIRES_IN as SignOptions['expiresIn'],
            secret: process.env.JWT_TOKEN_EMAIL_VERIFY_SECRET
        });

        this.logger.debug('Email verification token generated successfully', logContext);

        return { emailVerificationToken: encryptToken(emailVerificationToken) };
    }

    /** Signs the token for an invitation, identified by `invitationID`, to join an organization. */
    async generateTokenInvitation(invitationID: string): Promise<InvitationTokenType> {
        const logContext = 'AuthService-generateTokenInvitation';

        const payload = {
            sub: invitationID,
            tokenType: TokenTypes.Invitation
        };

        const invitationToken = await this.jwt.signAsync(payload, {
            expiresIn: process.env.JWT_TOKEN_INVITATION_EXPIRES_IN as SignOptions['expiresIn'],
            secret: process.env.JWT_TOKEN_INVITATION_SECRET
        });

        this.logger.debug('Invitation token generated successfully', logContext);

        return { invitationToken: encryptToken(invitationToken) };
    }

    /** Signs a session token and returns it with the moment it expires, read back from the token's own `exp` so the
     * cookie never outlives the token. */
    async generateTokenLogin(accountID: string): Promise<LoginTokenType> {
        const logContext = 'AuthService-generateTokenLogin';

        const accessTokenPayload = {
            sub: accountID,
            tokenType: TokenTypes.Access
        };

        const accessToken = await this.jwt.signAsync(accessTokenPayload, {
            expiresIn: process.env.JWT_TOKEN_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
            secret: process.env.JWT_TOKEN_ACCESS_SECRET
        });

        const { exp } = this.jwt.decode<TokenData>(accessToken);

        this.logger.debug('Login token generated successfully', logContext);

        return { accessToken: encryptToken(accessToken), accessTokenExpires: new Date(exp * 1000) };
    }

    /** Signs the token that identifies a pending login 2FA challenge, carrying the challenge's ID. */
    async generateTokenMFAChallenge(accountID: string, challengeID: string): Promise<MFAChallengeTokenType> {
        const mfaChallengeToken = await this.jwt.signAsync(
            { sub: accountID, challengeID, tokenType: TokenTypes.MFAChallenge },
            {
                expiresIn: process.env.JWT_TOKEN_MFA_CHALLENGE_EXPIRES_IN as SignOptions['expiresIn'],
                secret: process.env.JWT_TOKEN_MFA_CHALLENGE_SECRET
            }
        );

        return { mfaChallengeToken: encryptToken(mfaChallengeToken) };
    }

    /** Signs a password reset token. Its own `exp` is the only expiry: the stored hash just makes it single-use. */
    async generateTokenPasswordReset(accountID: string): Promise<PasswordResetTokenType> {
        const logContext = 'AuthService-generateTokenPasswordReset';

        const payload = {
            sub: accountID,
            tokenType: TokenTypes.PasswordReset
        };

        const passwordResetToken = await this.jwt.signAsync(payload, {
            expiresIn: process.env.JWT_TOKEN_PASSWORD_RESET_EXPIRES_IN as SignOptions['expiresIn'],
            secret: process.env.JWT_TOKEN_PASSWORD_RESET_SECRET
        });

        this.logger.debug('Password reset token generated successfully', logContext);

        return { passwordResetToken: encryptToken(passwordResetToken) };
    }

    /** The login cookie's options, shared by setting and clearing it so the two can't drift apart. */
    private getCookieOptions(): CookieOptions {
        const isProdEnv = process.env.NODE_ENV === 'production';

        return {
            domain: process.env.COOKIE_DOMAIN,
            httpOnly: true,
            sameSite: isProdEnv ? 'none' : 'lax',
            secure: isProdEnv
        };
    }

    /** Decrypts `token`, verifies the JWT's signature and expiry with `options.secret`, then checks it is an
     * `options.tokenType` token. Every failure is a 403: `options.expiredMessage` for an expired token, "Invalid
     * token." for anything else. The type check sits outside the `try`, so its own 403 isn't caught and turned into
     * "Invalid token.". */
    private async verifyToken<T extends TokenData>(
        token: string,
        logContext: string,
        options: { expiredMessage: string; ignoreExpiration?: boolean; secret: string; tokenType: TokenTypes }
    ): Promise<T> {
        const signedToken = decryptToken(token);

        if (!signedToken) {
            this.logger.warn(`Undecryptable ${options.tokenType}`, logContext);
            throw new ForbiddenException('Invalid token.');
        }

        let decodedToken: T;

        try {
            decodedToken = await this.jwt.verifyAsync<T>(signedToken, {
                ignoreExpiration: options.ignoreExpiration,
                secret: options.secret
            });
        } catch (error) {
            if (error instanceof TokenExpiredError) {
                this.logger.warn(`Expired ${options.tokenType}`, logContext);
                throw new ForbiddenException(options.expiredMessage);
            }

            this.logger.warn(`Invalid ${options.tokenType}`, logContext);
            throw new ForbiddenException('Invalid token.');
        }

        if (decodedToken.tokenType !== options.tokenType) {
            this.logger.warn(`Wrong token type: expected ${options.tokenType}`, logContext);
            throw new ForbiddenException('Invalid token type.');
        }

        return decodedToken;
    }
}
