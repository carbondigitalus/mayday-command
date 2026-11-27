/** What an upload must satisfy, and how it's prepared before storing. Each kind of asset (a logo, later a ticket
 * attachment) has its own rules. */
export default interface AssetUploadRules {
    /** Types allowed, as detected from the file's contents. */
    allowedContentTypes: string[];
    /** The largest upload accepted, in bytes. */
    maxBytes: number;
    /** Reworks the file before it's stored, returning the new bytes and their type: for example, resizing a logo. */
    transform?: (bytes: Buffer) => Promise<{ bytes: Buffer; contentType: string }>;
}
