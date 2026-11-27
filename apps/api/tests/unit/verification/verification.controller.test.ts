// NPM Modules
import { Test, TestingModule } from '@nestjs/testing';

// Custom Modules
import Account from 'src/database/account.entity';
import VerificationController from 'src/verification/verification.controller';
import VerificationService from 'src/verification/verification.service';
import JWTAccessTokenGuard from 'src/utils/guards/JWTAccessTokenGuard.guard';

describe('VerificationController', () => {
    let controller: VerificationController;
    let verificationService: { emailConfirm: jest.Mock; emailRequest: jest.Mock; emailResend: jest.Mock };

    beforeEach(async () => {
        verificationService = {
            emailConfirm: jest.fn(),
            emailRequest: jest.fn(),
            emailResend: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [VerificationController],
            providers: [{ provide: VerificationService, useValue: verificationService }]
        })
            .overrideGuard(JWTAccessTokenGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get(VerificationController);
    });

    it('verificationEmailConfirm delegates to the service', () => {
        const data = { emailVerificationToken: 't', oneTimePasscode: '123456' };
        verificationService.emailConfirm.mockReturnValue('confirmed');

        expect(controller.verificationEmailConfirm(data)).toBe('confirmed');
        expect(verificationService.emailConfirm).toHaveBeenCalledWith(data);
    });

    it('verificationEmailRequest passes the authenticated account to the service', () => {
        const user = { id: '1' } as Account;
        verificationService.emailRequest.mockReturnValue('requested');

        expect(controller.verificationEmailRequest(user)).toBe('requested');
        expect(verificationService.emailRequest).toHaveBeenCalledWith(user);
    });

    it('verificationEmailResend delegates to the service', () => {
        const data = { emailVerificationToken: 't' };
        verificationService.emailResend.mockReturnValue('resent');

        expect(controller.verificationEmailResend(data)).toBe('resent');
        expect(verificationService.emailResend).toHaveBeenCalledWith(data);
    });
});
