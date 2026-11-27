export default interface LoginTokenType {
    accessToken: string;
    /** When `accessToken` expires: its own `exp`, so the cookie can't outlive the token. */
    accessTokenExpires: Date;
}
