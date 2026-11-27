/** The file types the API recognizes, by the signature bytes each one starts with. */
const signatures: { contentType: string; matches: (bytes: Buffer) => boolean }[] = [
    {
        contentType: 'image/png',
        matches: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    },
    {
        contentType: 'image/jpeg',
        matches: (bytes) => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    },
    {
        contentType: 'image/webp',
        matches: (bytes) =>
            bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP'
    },
    {
        contentType: 'application/pdf',
        matches: (bytes) => bytes.subarray(0, 5).toString('latin1') === '%PDF-'
    }
];

/** The file's real type, read from its first bytes rather than trusted from its name or the browser's claim. `null`
 * for anything the API doesn't recognize, which callers refuse. */
export default function detectContentType(bytes: Buffer): string | null {
    return signatures.find((signature) => signature.matches(bytes))?.contentType ?? null;
}
