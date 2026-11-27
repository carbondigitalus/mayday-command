// Custom Modules
import TokenTypes from 'src/utils/enums/TokenTypes.enum';

/** The claims every JWT the API signs carries. Tokens add only what their purpose needs, so an encrypted token still
 * holds as little personal data as possible. */
export default interface TokenData {
    /** The ID the token is about: an account, or an invitation for invitation tokens. */
    sub: string;
    /** Issued at, in seconds since the epoch. */
    iat: number;
    /** Expires at, in seconds since the epoch. */
    exp: number;
    tokenType: TokenTypes;
}
