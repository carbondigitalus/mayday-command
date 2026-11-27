// Core Modules
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** AES-256-GCM: encrypted and authenticated, so a token that was altered fails to decrypt. */
const algorithm = 'aes-256-gcm';
const ivLength = 12;
const tagLength = 16;

/** The 32-byte AES key, derived from `JWT_ENCRYPTION_KEY` so any long random string works as the setting. */
function getKey(): Buffer {
    return createHash('sha256').update(process.env.JWT_ENCRYPTION_KEY).digest();
}

/** Encrypts a signed JWT before it leaves the API, so its claims can't be read by pasting it into a JWT decoder.
 * The result is URL-safe: the IV, the authentication tag, then the ciphertext, base64url-encoded together. */
export function encryptToken(token: string): string {
    const iv = randomBytes(ivLength);
    const cipher = createCipheriv(algorithm, getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);

    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

/** Reverses {@link encryptToken}. Returns `null` for anything that wasn't encrypted with this key or was altered, so
 * callers treat it like any other invalid token. */
export function decryptToken(encrypted: string): string | null {
    try {
        const data = Buffer.from(encrypted, 'base64url');

        if (data.length <= ivLength + tagLength) {
            return null;
        }

        const decipher = createDecipheriv(algorithm, getKey(), data.subarray(0, ivLength));
        decipher.setAuthTag(data.subarray(ivLength, ivLength + tagLength));

        return Buffer.concat([decipher.update(data.subarray(ivLength + tagLength)), decipher.final()]).toString('utf8');
    } catch {
        return null;
    }
}
