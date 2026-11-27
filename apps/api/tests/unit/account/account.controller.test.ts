// NPM Modules
import { Test, TestingModule } from '@nestjs/testing';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import AccountController from 'src/account/account.controller';
import AccountService from 'src/account/account.service';
import Account from 'src/database/account.entity';
import requiresRoleKey from 'src/utils/constants/role';
import RolesGuard from 'src/utils/guards/RolesGuard.guard';

describe('AccountController', () => {
    let controller: AccountController;
    let accountService: {
        readAll: jest.Mock;
        get: jest.Mock;
        activate: jest.Mock;
        deactivate: jest.Mock;
        adminSearch: jest.Mock;
        adminFindOne: jest.Mock;
        login: jest.Mock;
        logout: jest.Mock;
        passwordChange: jest.Mock;
        passwordForgot: jest.Mock;
        passwordReset: jest.Mock;
        register: jest.Mock;
        isSetupAdminRequired: jest.Mock;
        setupAdmin: jest.Mock;
        changeRole: jest.Mock;
        updateAccount: jest.Mock;
    };

    const res = { id: 'res' } as any;

    beforeEach(async () => {
        jest.clearAllMocks();

        accountService = {
            readAll: jest.fn(),
            get: jest.fn(),
            activate: jest.fn(),
            deactivate: jest.fn(),
            adminSearch: jest.fn(),
            adminFindOne: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
            passwordChange: jest.fn(),
            passwordForgot: jest.fn(),
            passwordReset: jest.fn(),
            register: jest.fn(),
            isSetupAdminRequired: jest.fn(),
            setupAdmin: jest.fn(),
            changeRole: jest.fn(),
            updateAccount: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AccountController],
            providers: [{ provide: AccountService, useValue: accountService }]
        })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get(AccountController);
    });

    it('accountReadAll delegates to accountService.readAll', () => {
        accountService.readAll.mockReturnValue('all-accounts');

        const result = controller.accountReadAll();

        expect(accountService.readAll).toHaveBeenCalledWith();
        expect(result).toBe('all-accounts');
    });

    it('accountRetrieve delegates to accountService.get', () => {
        const requester = { id: '1' } as any;
        accountService.get.mockReturnValue('account-data');

        const result = controller.accountRetrieve(requester);

        expect(accountService.get).toHaveBeenCalledWith(requester);
        expect(result).toBe('account-data');
    });

    it('accountActivate delegates to accountService.activate with the caller as performedBy', () => {
        const user = { id: '1' } as any;
        accountService.activate.mockReturnValue('activated');

        const result = controller.accountActivate(user);

        expect(accountService.activate).toHaveBeenCalledWith(user, '1');
        expect(result).toBe('activated');
    });

    it('accountDeactivate delegates to accountService.deactivate with the caller as performedBy', () => {
        const user = { id: '1' } as any;
        accountService.deactivate.mockReturnValue('deactivated');

        const result = controller.accountDeactivate(user);

        expect(accountService.deactivate).toHaveBeenCalledWith(user, '1');
        expect(result).toBe('deactivated');
    });

    it('accountAdminSearch delegates to accountService.adminSearch with the query params', () => {
        accountService.adminSearch.mockReturnValue('search-results');

        const result = controller.accountAdminSearch('true', '10', '2', 'jane');

        expect(accountService.adminSearch).toHaveBeenCalledWith({
            search: 'jane',
            isActive: 'true',
            page: '2',
            limit: '10'
        });
        expect(result).toBe('search-results');
    });

    it('accountAdminReadOne delegates to accountService.adminFindOne', () => {
        accountService.adminFindOne.mockReturnValue('account-detail');

        const result = controller.accountAdminReadOne('acc-1');

        expect(accountService.adminFindOne).toHaveBeenCalledWith('acc-1');
        expect(result).toBe('account-detail');
    });

    it('accountAdminActivate delegates to accountService.activate with the admin as performedBy', () => {
        const admin = { id: 'admin-1' } as Account;
        accountService.activate.mockReturnValue('activated');

        const result = controller.accountAdminActivate('acc-1', admin);

        expect(accountService.activate).toHaveBeenCalledWith({ id: 'acc-1' }, 'admin-1');
        expect(result).toBe('activated');
    });

    it('accountAdminDeactivate delegates to accountService.deactivate with the admin as performedBy', () => {
        const admin = { id: 'admin-1' } as Account;
        accountService.deactivate.mockReturnValue('deactivated');

        const result = controller.accountAdminDeactivate('acc-1', admin);

        expect(accountService.deactivate).toHaveBeenCalledWith({ id: 'acc-1' }, 'admin-1');
        expect(result).toBe('deactivated');
    });

    it('accountLogin delegates to accountService.login', () => {
        const data = { email: 'a@b.com', password: 'x' } as any;
        accountService.login.mockReturnValue('login-result');

        const result = controller.accountLogin(data, res);

        expect(accountService.login).toHaveBeenCalledWith(data, res);
        expect(result).toBe('login-result');
    });

    it('accountLogout delegates to accountService.logout', () => {
        accountService.logout.mockReturnValue('logout-result');

        const result = controller.accountLogout(res);

        expect(accountService.logout).toHaveBeenCalledWith(res);
        expect(result).toBe('logout-result');
    });

    it('accountPasswordChange passes the logged-in account along with the change', () => {
        const data = { currentPassword: 'old', password: 'a', passwordConfirm: 'a' };
        accountService.passwordChange.mockReturnValue('password-changed');

        const result = controller.accountPasswordChange({ id: 'requester-1' } as any, data, res);

        expect(accountService.passwordChange).toHaveBeenCalledWith('requester-1', data, res);
        expect(result).toBe('password-changed');
    });

    it('accountPasswordForgot delegates to accountService.passwordForgot', () => {
        const data = { email: 'a@b.com' } as any;
        accountService.passwordForgot.mockReturnValue('password-forgot');

        const result = controller.accountPasswordForgot(data);

        expect(accountService.passwordForgot).toHaveBeenCalledWith(data);
        expect(result).toBe('password-forgot');
    });

    it('accountPasswordReset delegates to accountService.passwordReset', () => {
        const data = { token: 'token-1', password: 'a', passwordConfirm: 'a' } as any;
        accountService.passwordReset.mockReturnValue('password-reset');

        const result = controller.accountPasswordReset(data, res);

        expect(accountService.passwordReset).toHaveBeenCalledWith(data, res);
        expect(result).toBe('password-reset');
    });

    it('accountRegister delegates to accountService.register', () => {
        const data = { email: 'a@b.com' } as any;
        accountService.register.mockReturnValue('registered');

        const result = controller.accountRegister(data);

        expect(accountService.register).toHaveBeenCalledWith(data);
        expect(result).toBe('registered');
    });

    it('accountUpdateSettings passes the logged-in account along with the update', () => {
        const data = { firstName: 'F', lastName: 'L' };
        accountService.updateAccount.mockReturnValue('updated');

        const result = controller.accountUpdateSettings({ id: 'requester-1' } as any, data);

        expect(accountService.updateAccount).toHaveBeenCalledWith(data, 'requester-1');
        expect(result).toBe('updated');
    });

    it('accountSetupAdminStatus reports whether first-admin setup is still needed', () => {
        accountService.isSetupAdminRequired.mockReturnValue({ setupRequired: true });

        expect(controller.accountSetupAdminStatus()).toEqual({ setupRequired: true });
    });

    it('accountSetupAdmin delegates to accountService.setupAdmin with the response, to set the session cookie', () => {
        const data = {
            email: 'a@b.com',
            firstName: 'A',
            lastName: 'B',
            password: 'p',
            passwordConfirm: 'p'
        };
        accountService.setupAdmin.mockReturnValue('admin-session');

        expect(controller.accountSetupAdmin(data, res)).toBe('admin-session');
        expect(accountService.setupAdmin).toHaveBeenCalledWith(data, res);
    });

    it('accountAdminChangeRole is platform:admin only and passes the new role to the service', () => {
        accountService.changeRole.mockReturnValue({ id: 'acc-1', role: AccountRole.PlatformAgent });

        expect(Reflect.getMetadata(requiresRoleKey, AccountController.prototype.accountAdminChangeRole)).toEqual({
            role: AccountRole.PlatformAdmin,
            resourceParam: undefined
        });
        expect(controller.accountAdminChangeRole('acc-1', { role: AccountRole.PlatformAgent })).toEqual({
            id: 'acc-1',
            role: AccountRole.PlatformAgent
        });
        expect(accountService.changeRole).toHaveBeenCalledWith('acc-1', AccountRole.PlatformAgent);
    });
});
