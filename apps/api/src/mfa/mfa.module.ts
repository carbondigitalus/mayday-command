// NPM Modules
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Custom Modules
import EmailMFAMethod from './email.mfa-method';
import MFAController from './mfa.controller';
import mfaMethodHandlersToken from './mfa-method-handlers.token';
import MFAService from './mfa.service';
import AuthModule from 'src/auth/auth.module';
import Account from 'src/database/account.entity';
import MFAChallenge from 'src/database/mfa-challenge.entity';
import MessageQueueModule from 'src/message-queue/mq.module';
import OneTimePasscodeModule from 'src/otp/one-time-passcode.module';

/** Wires up the second factor asked for at login: the challenge table, the
 * signed challenge token from AuthService, the 'email' queue the code is sent
 * on, and the list of methods a challenge can use. Add a method by providing
 * it here and adding it to the handlers list. */
@Module({
    controllers: [MFAController],
    exports: [MFAService],
    imports: [AuthModule, MessageQueueModule, OneTimePasscodeModule, TypeOrmModule.forFeature([Account, MFAChallenge])],
    providers: [
        EmailMFAMethod,
        MFAService,
        {
            inject: [EmailMFAMethod],
            provide: mfaMethodHandlersToken,
            useFactory: (emailMFAMethod: EmailMFAMethod) => [emailMFAMethod]
        }
    ]
})
export default class MFAModule {}
