// NPM Modules
import { Throttle } from '@nestjs/throttler';

/**
 * Holds a route to a far tighter limit than the app-wide default, and blocks
 * the requesting IP outright once it is exceeded. For the public routes that
 * guess at, or trigger work for, an account: login, registration, password
 * reset and the verification and 2FA codes.
 */
const StrictThrottle = () =>
    Throttle({
        default: {
            blockDuration: 15 * 60 * 1000,
            limit: 10,
            ttl: 60 * 1000
        }
    });

export default StrictThrottle;
