// NPM Modules
import sharp from 'sharp';

// Custom Modules
import detectContentType from 'src/utils/helpers/detectContentType';

describe('detectContentType', () => {
    const image = (format: 'jpeg' | 'png' | 'webp') =>
        sharp({ create: { background: 'red', channels: 3, height: 4, width: 4 } })
            .toFormat(format)
            .toBuffer();

    it.each([
        ['png', 'image/png'],
        ['jpeg', 'image/jpeg'],
        ['webp', 'image/webp']
    ] as const)('recognizes a real %s file from its contents', async (format, contentType) => {
        expect(detectContentType(await image(format))).toBe(contentType);
    });

    it('recognizes a PDF', () => {
        expect(detectContentType(Buffer.from('%PDF-1.7\n...'))).toBe('application/pdf');
    });

    it.each([
        ['an HTML page', Buffer.from('<html><script>alert(1)</script></html>')],
        ['a GIF', Buffer.from('GIF89a......')],
        ['an empty file', Buffer.alloc(0)]
    ])('returns null for %s', (_name, bytes) => {
        expect(detectContentType(bytes)).toBeNull();
    });
});
