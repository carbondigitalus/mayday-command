// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import requiresRoleKey from 'src/utils/constants/role';
import RequiresRole from 'src/utils/decorators/RequiresRole.decorator';

describe('RequiresRole', () => {
    it('attaches the role and resourceParam as route metadata', () => {
        class TestController {
            @RequiresRole(AccountRole.OrganizationAdmin, 'organizationID')
            testMethod() {}
        }

        const metadata = Reflect.getMetadata(requiresRoleKey, TestController.prototype.testMethod);

        expect(metadata).toEqual({
            role: AccountRole.OrganizationAdmin,
            resourceParam: 'organizationID'
        });
    });

    it('omits resourceParam for a requirement not tied to one organization', () => {
        class TestController {
            @RequiresRole(AccountRole.PlatformAdmin)
            testMethod() {}
        }

        const metadata = Reflect.getMetadata(requiresRoleKey, TestController.prototype.testMethod);

        expect(metadata).toEqual({
            role: AccountRole.PlatformAdmin,
            resourceParam: undefined
        });
    });

    it('accepts an array of roles for an "any of these" requirement', () => {
        class TestController {
            @RequiresRole([AccountRole.OrganizationAdmin, AccountRole.OrganizationMember], 'organizationID')
            testMethod() {}
        }

        const metadata = Reflect.getMetadata(requiresRoleKey, TestController.prototype.testMethod);

        expect(metadata).toEqual({
            role: [AccountRole.OrganizationAdmin, AccountRole.OrganizationMember],
            resourceParam: 'organizationID'
        });
    });
});
