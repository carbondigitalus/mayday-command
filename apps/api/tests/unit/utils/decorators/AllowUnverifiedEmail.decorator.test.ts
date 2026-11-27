// Custom Modules
import allowUnverifiedEmailKey from 'src/utils/constants/allow-unverified-email';
import AllowUnverifiedEmail from 'src/utils/decorators/AllowUnverifiedEmail.decorator';

describe('AllowUnverifiedEmail', () => {
    it('flags the route as open to unverified accounts', () => {
        class TestController {
            @AllowUnverifiedEmail()
            testMethod() {}
        }

        const metadata = Reflect.getMetadata(allowUnverifiedEmailKey, TestController.prototype.testMethod);

        expect(metadata).toBe(true);
    });
});
