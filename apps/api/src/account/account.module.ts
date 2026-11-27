// NPM Modules
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Custom Modules
import AccountController from './account.controller';
import AccountService from './account.service';
import AuthModule from 'src/auth/auth.module';
import Access from 'src/database/access.entity';
import Account from 'src/database/account.entity';
import MessageQueueModule from 'src/message-queue/mq.module';
import MFAModule from 'src/mfa/mfa.module';
import AccessTokenStrategy from 'src/utils/strategy/AccessTokenStrategy.strategy';
import VerificationModule from 'src/verification/verification.module';

@Module({
    imports: [
        forwardRef(() => AuthModule),
        MessageQueueModule,
        MFAModule,
        TypeOrmModule.forFeature([Access, Account]),
        VerificationModule
    ],
    exports: [TypeOrmModule],
    controllers: [AccountController],
    providers: [AccessTokenStrategy, AccountService]
})
export default class AccountModule {}
