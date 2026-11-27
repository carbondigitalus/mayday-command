// NPM Modules
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

// Custom Modules
import AuthService from './auth.service';
import Account from 'src/database/account.entity';
import JWTAccessTokenGuard from 'src/utils/guards/JWTAccessTokenGuard.guard';
import AccessTokenStrategy from 'src/utils/strategy/AccessTokenStrategy.strategy';

/** Token signing and verification, the login cookie, and the session check (`AccessTokenStrategy` and
 * `JWTAccessTokenGuard`) that protected routes use. */
@Module({
    exports: [AccessTokenStrategy, AuthService, JWTAccessTokenGuard, TypeOrmModule],
    imports: [JwtModule.register({}), TypeOrmModule.forFeature([Account])],
    providers: [AccessTokenStrategy, AuthService, JWTAccessTokenGuard]
})
export default class AuthModule {}
