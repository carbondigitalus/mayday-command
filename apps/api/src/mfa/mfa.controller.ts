// NPM Modules
import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response as ExpressResponse } from 'express';

// Custom Modules
import MFAResendDTO from './dto/resend.dto';
import MFAVerifyDTO from './dto/verify.dto';
import MFAService from './mfa.service';
import StrictThrottle from 'src/utils/decorators/StrictThrottle.decorator';

/** Route /mfa */
@Controller('mfa')
export default class MFAController {
    constructor(private mfaService: MFAService) {}

    /** `POST /mfa/resend`: replaces the pending login code with a fresh one, after the one-minute wait and within the
     * hourly cap. Public: the `mfaToken` from login identifies the challenge. */
    @StrictThrottle()
    @Post('resend')
    mfaResend(@Body() data: MFAResendDTO) {
        return this.mfaService.resend(data);
    }

    /** `POST /mfa/verify`: checks the login code and, when it matches, sets the session cookie. Public: the `mfaToken`
     * from login identifies the challenge; 5 wrong codes and a new one must be requested. */
    @StrictThrottle()
    @Post('verify')
    mfaVerify(@Body() data: MFAVerifyDTO, @Res({ passthrough: true }) res: ExpressResponse) {
        return this.mfaService.verify(data, res);
    }
}
