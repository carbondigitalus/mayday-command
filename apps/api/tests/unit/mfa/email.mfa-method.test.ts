// NPM Modules
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';

// Custom Modules
import EmailMFAMethod from 'src/mfa/email.mfa-method';
import OneTimePasscodeService from 'src/otp/one-time-passcode.service';
import MFAMethod from '@mayday-command/utils/enums/MFAMethod.enum';
import VerificationType from '@mayday-command/utils/enums/VerificationType.enum';

describe('EmailMFAMethod', () => {
    let method: EmailMFAMethod;
    let emailQueue: { add: jest.Mock };
    let oneTimePasscode: { generate: jest.Mock; hash: jest.Mock; matches: jest.Mock };

    const account: any = { id: 'acc-1', firstName: 'Jane', lastName: 'Doe', email: 'jared@carbondigital.us' };

    beforeEach(async () => {
        emailQueue = { add: jest.fn() };
        oneTimePasscode = {
            generate: jest.fn().mockReturnValue('123456'),
            hash: jest.fn().mockResolvedValue('hashed-code'),
            matches: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmailMFAMethod,
                { provide: getQueueToken('email'), useValue: emailQueue },
                { provide: OneTimePasscodeService, useValue: oneTimePasscode }
            ]
        }).compile();

        method = module.get(EmailMFAMethod);
    });

    it('identifies itself as the email method and requires a verified email', () => {
        expect(method.method).toBe(MFAMethod.Email);
        expect(method.verificationType).toBe(VerificationType.Email);
    });

    it('masks the address it will send to', () => {
        expect(method.getDestination(account)).toBe('j***@carbondigital.us');
    });

    describe('issue', () => {
        it('emails the plain code and hands back only its hash', async () => {
            const result = await method.issue(account);

            expect(emailQueue.add).toHaveBeenCalledWith('mfa-code', {
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jared@carbondigital.us',
                oneTimePasscode: '123456'
            });
            expect(oneTimePasscode.hash).toHaveBeenCalledWith('123456');
            expect(result).toEqual({ codeHash: 'hashed-code' });
        });
    });

    describe('verify', () => {
        it('checks the submitted code against the stored hash', async () => {
            oneTimePasscode.matches.mockResolvedValue(true);

            await expect(method.verify({ codeHash: 'hashed-code' } as any, '123456')).resolves.toBe(true);
            expect(oneTimePasscode.matches).toHaveBeenCalledWith('hashed-code', '123456');
        });

        it('rejects a wrong code', async () => {
            oneTimePasscode.matches.mockResolvedValue(false);

            await expect(method.verify({ codeHash: 'hashed-code' } as any, '000000')).resolves.toBe(false);
        });

        it('rejects everything when the challenge has no stored hash', async () => {
            await expect(method.verify({ codeHash: null } as any, '123456')).resolves.toBe(false);
            expect(oneTimePasscode.matches).not.toHaveBeenCalled();
        });
    });
});
