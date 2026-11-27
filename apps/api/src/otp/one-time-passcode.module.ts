// NPM Modules
import { Module } from '@nestjs/common';

// Custom Modules
import OneTimePasscodeService from './one-time-passcode.service';

/** Provides `OneTimePasscodeService`, the shared mechanics of the six-digit codes used by email verification and login
 * 2FA. */
@Module({
    exports: [OneTimePasscodeService],
    providers: [OneTimePasscodeService]
})
export default class OneTimePasscodeModule {}
