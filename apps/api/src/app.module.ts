// NPM Modules
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/adapters/pug.adapter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

// Custom Modules
import AccessModule from './access/access.module';
import AccountModule from './account/account.module';
import AuthModule from './auth/auth.module';
import Access from './database/access.entity';
import Account from './database/account.entity';
import Invitation from './database/invitation.entity';
import MFAChallenge from './database/mfa-challenge.entity';
import ModuleEntity from './database/module.entity';
import Organization from './database/organization.entity';
import Role from './database/role.entity';
import EmailModule from './email/email.module';
import InvitationModule from './invitation/invitation.module';
import LoggerModule from './logger/logger.module';
import MessageQueueModule from './message-queue/mq.module';
import MFAModule from './mfa/mfa.module';
import OrganizationModule from './organization/organization.module';
import RoleModule from './role/role.module';
import JWTExceptionFilter from './utils/filters/JWTException.filter';
import TypeORMExceptionFilter from './utils/filters/TypeORMException.filter';
import VerificationModule from './verification/verification.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: `.env.${process.env.NODE_ENV}`,
            isGlobal: true
        }),
        MailerModule.forRoot({
            transport: {
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT,
                ignoreTLS: true,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USERNAME,
                    pass: process.env.EMAIL_PASSWORD
                }
            },
            defaults: {
                from: `"${process.env.EMAIL_FROM}" <${process.env.EMAIL_FROM_ADDRESS}>`
            },
            template: {
                dir: `${process.cwd()}/views/emails`,
                adapter: new PugAdapter(),
                options: {
                    strict: true
                }
            }
        }),
        // app-wide ceiling per IP; sensitive routes tighten it with StrictThrottle
        // an IPv6 client is counted by its /64, the block one subscriber holds, so rotating addresses within it
        // doesn't give a fresh limit
        ThrottlerModule.forRoot({
            ipv6SubnetPrefix: 64,
            throttlers: [{ limit: 120, name: 'default', ttl: 60 * 1000 }]
        }),
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_TABLE,
            entities: [Access, Account, Invitation, MFAChallenge, ModuleEntity, Organization, Role],
            ssl:
                process.env.DB_SSL === 'true'
                    ? {
                          rejectUnauthorized: false
                      }
                    : false,
            synchronize: true
        }),
        AccessModule,
        AccountModule,
        AuthModule,
        EmailModule,
        InvitationModule,
        LoggerModule,
        MessageQueueModule,
        MFAModule,
        OrganizationModule,
        RoleModule,
        VerificationModule
    ],
    controllers: [],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard
        },
        {
            provide: APP_FILTER,
            useClass: JWTExceptionFilter
        },
        {
            provide: APP_FILTER,
            useClass: TypeORMExceptionFilter
        }
    ]
})
export default class AppModule {}
