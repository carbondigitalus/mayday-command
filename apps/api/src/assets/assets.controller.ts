// NPM Modules
import { Controller, Get, Param, ParseUUIDPipe, Res, UseGuards } from '@nestjs/common';
import { Response as ExpressResponse } from 'express';

// Custom Modules
import AssetsService from './assets.service';
import Account from 'src/database/account.entity';
import GetAccountData from 'src/utils/decorators/GetAccountData.decorator';
import JWTAccessTokenGuard from 'src/utils/guards/JWTAccessTokenGuard.guard';

/** Route /asset */
@Controller('asset')
export default class AssetsController {
    constructor(private assetsService: AssetsService) {}

    /** `GET /asset/:assetID`: redirects to a short-lived signed link for the file, when the signed-in account may see
     * it; otherwise 404. Works as an `<img>` or download URL. The redirect is marked not to be cached, since the signed
     * link it points to expires in minutes. */
    @UseGuards(JWTAccessTokenGuard)
    @Get(':assetID')
    async assetReadOne(
        @Param('assetID', ParseUUIDPipe) assetID: string,
        @GetAccountData('account') account: Account,
        @Res() res: ExpressResponse
    ) {
        const url = await this.assetsService.getDownloadURL(assetID, account);

        res.setHeader('Cache-Control', 'private, no-store');
        res.redirect(302, url);
    }
}
