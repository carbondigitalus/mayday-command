// NPM Modules
import { SetMetadata } from '@nestjs/common';

// Custom Modules
import allowUnverifiedEmailKey from '../constants/allow-unverified-email';

/**
 * Exempts a route from the verification check
 * {@link JWTAccessTokenGuard} applies to every account. Reserved for the
 * routes an unverified account needs in order to become verified: reading
 * its own account, logging out, and requesting a verification code.
 */
const AllowUnverifiedEmail = () => SetMetadata(allowUnverifiedEmailKey, true);

export default AllowUnverifiedEmail;
