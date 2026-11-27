// NPM Modules
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Custom Modules
import InvitationController from './invitation.controller';
import InvitationService from './invitation.service';
import AccountModule from 'src/account/account.module';
import AuthModule from 'src/auth/auth.module';
import Account from 'src/database/account.entity';
import Invitation from 'src/database/invitation.entity';
import Organization from 'src/database/organization.entity';
import MessageQueueModule from 'src/message-queue/mq.module';

/** Wires up the Invitation create/accept flow and its dependencies on AuthService (token generation), AccountService
 * (role and membership on accept), and the 'email' queue (the invite email). */
@Module({
    controllers: [InvitationController],
    exports: [TypeOrmModule],
    imports: [
        AccountModule,
        AuthModule,
        MessageQueueModule,
        TypeOrmModule.forFeature([Account, Invitation, Organization])
    ],
    providers: [InvitationService]
})
export default class InvitationModule {}
