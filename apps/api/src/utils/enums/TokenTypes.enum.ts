/** The `tokenType` claim on every JWT the API signs. Each type has its own secret, and decoding checks the claim, so
 * a token issued for one purpose can't be used for another. */
enum TokenTypes {
    /** The session token in the login cookie. */
    Access = 'access-token',
    /** Identifies the account on the email verification page. */
    EmailVerify = 'email-verify-token',
    /** Identifies an invitation to join an organization. */
    Invitation = 'invitation-token',
    /** Identifies a pending login 2FA challenge. */
    MFAChallenge = 'mfa-challenge-token',
    /** Emailed to reset a forgotten password. */
    PasswordReset = 'password-reset-token'
}
export default TokenTypes;
