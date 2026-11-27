// NPM Modules
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Custom Modules
import VerificationController from './verification.controller';
import VerificationService from './verification.service';
import AuthModule from 'src/auth/auth.module';
import Account from 'src/database/account.entity';
import MessageQueueModule from 'src/message-queue/mq.module';
import OneTimePasscodeModule from 'src/otp/one-time-passcode.module';

/** Wires up email verification: the signed token from AuthService, the
 * 'email' queue for the verification and welcome emails, and Account for
 * the code challenge and the `verifications.email` record. */
@Module({
    controllers: [VerificationController],
    exports: [VerificationService],
    imports: [AuthModule, MessageQueueModule, OneTimePasscodeModule, TypeOrmModule.forFeature([Account])],
    providers: [VerificationService]
})
export default class VerificationModule {}
