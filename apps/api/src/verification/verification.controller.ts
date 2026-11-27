// NPM Modules
import { Body, Controller, Post, UseGuards } from '@nestjs/common';

// Custom Modules
import VerificationEmailConfirmDTO from './dto/email-confirm.dto';
import VerificationEmailResendDTO from './dto/email-resend.dto';
import VerificationService from './verification.service';
import Account from 'src/database/account.entity';
import AllowUnverifiedEmail from 'src/utils/decorators/AllowUnverifiedEmail.decorator';
import GetAccountData from 'src/utils/decorators/GetAccountData.decorator';
import StrictThrottle from 'src/utils/decorators/StrictThrottle.decorator';
import JWTAccessTokenGuard from 'src/utils/guards/JWTAccessTokenGuard.guard';

/** Route /verification */
@Controller('verification')
export default class VerificationController {
    constructor(private verificationService: VerificationService) {}

    /** `POST /verification/email/confirm`: checks the emailed code against the verification token and, when it
     * matches, marks the email verified. Public, since the person may not be signed in; 5 wrong codes and it must be
     * requested again. */
    @StrictThrottle()
    @Post('email/confirm')
    verificationEmailConfirm(@Body() data: VerificationEmailConfirmDTO) {
        return this.verificationService.emailConfirm(data);
    }

    /** `POST /verification/email/request`: sends the signed-in account a code, unless one is still live, so reloading
     * the portal never replaces a code already in the inbox. Allowed before the email is verified. */
    @UseGuards(JWTAccessTokenGuard)
    @AllowUnverifiedEmail()
    @StrictThrottle()
    @Post('email/request')
    verificationEmailRequest(@GetAccountData('account') account: Account) {
        return this.verificationService.emailRequest(account);
    }

    /** `POST /verification/email/resend`: sends a fresh code after the resend wait, from the verification token alone.
     * Public, and accepts a lapsed token, so an expired link can still get a new code. */
    @StrictThrottle()
    @Post('email/resend')
    verificationEmailResend(@Body() data: VerificationEmailResendDTO) {
        return this.verificationService.emailResend(data);
    }
}
