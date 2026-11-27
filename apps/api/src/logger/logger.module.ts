// NPM Modules
import { Global, Module } from '@nestjs/common';

// Custom Modules
import LoggerService from './logger.service';

/** Provides the one shared `LoggerService`. Global, so every module can inject it without importing this module or
 * listing the service in its own providers. */
@Global()
@Module({
    exports: [LoggerService],
    providers: [LoggerService]
})
export default class LoggerModule {}
