// Custom Modules
import StrictThrottle from 'src/utils/decorators/StrictThrottle.decorator';

describe('StrictThrottle', () => {
    class TestController {
        @StrictThrottle()
        testMethod() {}
    }

    const metadata = (suffix: string) =>
        Reflect.getMetadata(`THROTTLER:${suffix}default`, TestController.prototype.testMethod);

    it('allows ten requests a minute', () => {
        expect(metadata('LIMIT')).toBe(10);
        expect(metadata('TTL')).toBe(60 * 1000);
    });

    it('blocks the IP for fifteen minutes once the limit is exceeded', () => {
        expect(metadata('BLOCK_DURATION')).toBe(15 * 60 * 1000);
    });
});
