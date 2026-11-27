// NPM Modules
import { Response } from 'express';

// Custom Modules
import AssetsController from 'src/assets/assets.controller';
import AssetsService from 'src/assets/assets.service';
import Account from 'src/database/account.entity';

describe('AssetsController', () => {
    const assetsService = { getDownloadURL: jest.fn() };
    const controller = new AssetsController(assetsService as unknown as AssetsService);

    it('redirects to the signed link, marked not to be cached', async () => {
        const account = { id: 'acc-1' } as Account;
        const res = { redirect: jest.fn(), setHeader: jest.fn() };
        assetsService.getDownloadURL.mockResolvedValue('https://signed.example/assets/abc');

        await controller.assetReadOne('asset-1', account, res as unknown as Response);

        expect(assetsService.getDownloadURL).toHaveBeenCalledWith('asset-1', account);
        expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
        expect(res.redirect).toHaveBeenCalledWith(302, 'https://signed.example/assets/abc');
    });
});
