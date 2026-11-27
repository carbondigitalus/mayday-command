// NPM Modules
import { Test, TestingModule } from '@nestjs/testing';

// Custom Modules
import MFAController from 'src/mfa/mfa.controller';
import MFAService from 'src/mfa/mfa.service';

describe('MFAController', () => {
    let controller: MFAController;
    let service: { resend: jest.Mock; verify: jest.Mock };

    beforeEach(async () => {
        service = { resend: jest.fn(), verify: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [MFAController],
            providers: [{ provide: MFAService, useValue: service }]
        }).compile();

        controller = module.get(MFAController);
    });

    it('mfaResend delegates to the service', () => {
        const data = { mfaToken: 'token' };
        service.resend.mockReturnValue('resent');

        expect(controller.mfaResend(data)).toBe('resent');
        expect(service.resend).toHaveBeenCalledWith(data);
    });

    it('mfaVerify passes the request and response through so the service can set the cookie', () => {
        const data = { mfaToken: 'token', oneTimePasscode: '123456' };
        const res = {} as any;
        service.verify.mockReturnValue('verified');

        expect(controller.mfaVerify(data, res)).toBe('verified');
        expect(service.verify).toHaveBeenCalledWith(data, res);
    });
});
