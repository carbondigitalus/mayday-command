// NPM Modules
import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Res,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';

// Custom Modules
import AccountService from './account.service';
import AccountLoginDTO from './dto/login.dto';
import AccountPasswordChangeDTO from './dto/password-change.dto';
import AccountPasswordForgotDTO from './dto/password-forgot.dto';
import AccountPasswordResetDTO from './dto/password-reset.dto';
import AccountRegisterDTO from './dto/register.dto';
import AccountUpdateDTO from './dto/update.dto';
import Account from 'src/database/account.entity';
import AllowUnverifiedEmail from 'src/utils/decorators/AllowUnverifiedEmail.decorator';
import GetAccountData from 'src/utils/decorators/GetAccountData.decorator';
import RequiresRole from 'src/utils/decorators/RequiresRole.decorator';
import StrictThrottle from 'src/utils/decorators/StrictThrottle.decorator';
import JWTAccessTokenGuard from 'src/utils/guards/JWTAccessTokenGuard.guard';
import RolesGuard from 'src/utils/guards/RolesGuard.guard';

/** Route /account */
@UseInterceptors(ClassSerializerInterceptor)
@Controller('account')
export default class AccountController {
    constructor(private accountService: AccountService) {}

    /** `GET /account`: the ID of every account. platform:admin or platform:agent only. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(['platform:admin', 'platform:agent'])
    @Get('/')
    accountReadAll() {
        return this.accountService.readAll();
    }

    /** `POST /account`: the signed-in account. Allowed before the email is verified, so onboarding can read it. */
    @UseGuards(JWTAccessTokenGuard)
    @AllowUnverifiedEmail()
    @Post('/')
    accountRetrieve(@GetAccountData('account') requester: Account) {
        return this.accountService.get(requester);
    }

    /** `POST /account/activate`: activates the signed-in account. platform:admin or platform:agent only, until
     * customer self-service activation lands with the admin settings table. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(['platform:admin', 'platform:agent'])
    @Post('activate')
    accountActivate(@GetAccountData('account') account: Account) {
        return this.accountService.activate(account, account.id);
    }

    /** `DELETE /account/deactivate`: deactivates the signed-in account. platform:admin or platform:agent only, until
     * customer self-service deactivation lands with the admin settings table. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(['platform:admin', 'platform:agent'])
    @Delete('deactivate')
    accountDeactivate(@GetAccountData('account') account: Account) {
        return this.accountService.deactivate(account, account.id);
    }

    /** `GET /account/admin`: a page of accounts, searched by email, first or last name and filtered by `isActive`.
     * platform:admin only. An account's roles and organization access are at `GET /access/account/:accountID`. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole('platform:admin')
    @Get('admin')
    accountAdminSearch(
        @Query('isActive') isActive?: string,
        @Query('limit') limit?: string,
        @Query('page') page?: string,
        @Query('search') search?: string
    ) {
        return this.accountService.adminSearch({ isActive, limit, page, search });
    }

    /** `GET /account/admin/:accountID`: one account by ID. platform:admin only. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole('platform:admin')
    @Get('admin/:accountID')
    accountAdminReadOne(@Param('accountID') accountID: string) {
        return this.accountService.adminFindOne(accountID);
    }

    /** `PATCH /account/admin/:accountID/activate`: activates any account. platform:admin only. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole('platform:admin')
    @Patch('admin/:accountID/activate')
    accountAdminActivate(@Param('accountID') accountID: string, @GetAccountData('account') admin: Account) {
        return this.accountService.activate({ id: accountID }, admin.id);
    }

    /** `PATCH /account/admin/:accountID/deactivate`: deactivates any account. platform:admin only. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole('platform:admin')
    @Patch('admin/:accountID/deactivate')
    accountAdminDeactivate(@Param('accountID') accountID: string, @GetAccountData('account') admin: Account) {
        return this.accountService.deactivate({ id: accountID }, admin.id);
    }

    /** `POST /account/login`: sets the session cookie, or returns a second-factor challenge when 2FA is due. */
    @StrictThrottle()
    @Post('login')
    accountLogin(@Body() data: AccountLoginDTO, @Res({ passthrough: true }) res: ExpressResponse) {
        return this.accountService.login(data, res);
    }

    /** `POST /account/logout`: clears the session cookie. Allowed before the email is verified. */
    @UseGuards(JWTAccessTokenGuard)
    @AllowUnverifiedEmail()
    @Post('logout')
    accountLogout(@Res({ passthrough: true }) res: ExpressResponse) {
        return this.accountService.logout(res);
    }

    /** `PATCH /account/password-change`: changes the signed-in account's password and reissues the session cookie. */
    @StrictThrottle()
    @UseGuards(JWTAccessTokenGuard)
    @Patch('password-change')
    accountPasswordChange(
        @GetAccountData('account') requester: Account,
        @Body() data: AccountPasswordChangeDTO,
        @Res({ passthrough: true }) res: ExpressResponse
    ) {
        return this.accountService.passwordChange(requester.id, data, res);
    }

    /** `POST /account/password-forgot`: emails a password reset link. Answers the same whether or not the email
     * exists. */
    @StrictThrottle()
    @Post('password-forgot')
    accountPasswordForgot(@Body() data: AccountPasswordForgotDTO) {
        return this.accountService.passwordForgot(data);
    }

    /** `PATCH /account/password-reset`: sets a new password from the emailed reset token and signs the account in. */
    @StrictThrottle()
    @Patch('password-reset')
    accountPasswordReset(@Body() data: AccountPasswordResetDTO, @Res({ passthrough: true }) res: ExpressResponse) {
        return this.accountService.passwordReset(data, res);
    }

    /** `POST /account/register`: creates an account and starts email verification. */
    @StrictThrottle()
    @Post('register')
    accountRegister(@Body() data: AccountRegisterDTO) {
        return this.accountService.register(data);
    }

    /** `PATCH /account/update`: updates the signed-in account's first and last name. */
    @UseGuards(JWTAccessTokenGuard)
    @Patch('update')
    accountUpdateSettings(@GetAccountData('account') requester: Account, @Body() data: AccountUpdateDTO) {
        return this.accountService.updateAccount(data, requester.id);
    }
}
