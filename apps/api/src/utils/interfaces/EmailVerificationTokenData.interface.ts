// Custom Modules
import TokenData from './TokenData.interface';

/** An email verification token's claims. It carries the address the code was sent to, so the token stops working if
 * the account's email changes before it is used. */
export default interface EmailVerificationTokenData extends TokenData {
    email: string;
}
