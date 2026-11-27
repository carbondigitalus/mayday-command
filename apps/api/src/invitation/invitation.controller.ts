// NPM Modules
import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Get,
    Param,
    Post,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';

// Shared Modules
import { organizationManagerRoles, staffAccessRoles } from '@mayday-command/utils/constants/roles.constants';

// Custom Modules
import InvitationService from './invitation.service';
import InvitationCreateDTO from './dto/create.dto';
import InvitationTokenDTO from './dto/token.dto';
import Account from 'src/database/account.entity';
import GetAccountData from 'src/utils/decorators/GetAccountData.decorator';
import RequiresRole from 'src/utils/decorators/RequiresRole.decorator';
import JWTAccessTokenGuard from 'src/utils/guards/JWTAccessTokenGuard.guard';
import RolesGuard from 'src/utils/guards/RolesGuard.guard';

/** Route /invitation */
@UseInterceptors(ClassSerializerInterceptor)
@Controller('invitation')
export default class InvitationController {
    constructor(private invitationService: InvitationService) {}

    /** `POST /invitation/accept`: accepts an invitation by its emailed token, for the signed-in account it was sent
     * to. Works for new and existing accounts alike. */
    @UseGuards(JWTAccessTokenGuard)
    @Post('accept')
    invitationAccept(@Body() data: InvitationTokenDTO, @GetAccountData('account') account: Account) {
        return this.invitationService.accept(data.invitationToken, account.id);
    }

    /** `POST /invitation/:invitationID/accept`: accepts an invitation by ID from the in-app Invites tab, where the
     * client has no emailed token. Only for the signed-in account it was sent to. */
    @UseGuards(JWTAccessTokenGuard)
    @Post(':invitationID/accept')
    invitationAcceptByID(@Param('invitationID') invitationID: string, @GetAccountData('account') account: Account) {
        return this.invitationService.acceptInviteByID(invitationID, account.id);
    }

    /** `POST /invitation/organization/:organizationID`: invites someone into the organization. organization:admin of
     * it, or a platform admin or agent, which is how staff invite a new organization's first admin. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(organizationManagerRoles, 'organizationID')
    @Post('organization/:organizationID')
    invitationCreateOrganizationScoped(
        @Param('organizationID') organizationID: string,
        @Body() data: InvitationCreateDTO,
        @GetAccountData('account') invitedBy: Account
    ) {
        return this.invitationService.create(invitedBy.id, data, organizationID);
    }

    /** `POST /invitation`: invites someone to a platform role, with no organization. platform:admin only. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(staffAccessRoles)
    @Post()
    invitationCreatePlatform(@Body() data: InvitationCreateDTO, @GetAccountData('account') invitedBy: Account) {
        return this.invitationService.create(invitedBy.id, data);
    }

    /** `POST /invitation/decline`: declines an invitation by its emailed token. No sign-in needed: the invitee may not
     * have an account, and holding the token is the authorization. */
    @Post('decline')
    invitationDecline(@Body() data: InvitationTokenDTO) {
        return this.invitationService.decline(data.invitationToken);
    }

    /** `POST /invitation/:invitationID/decline`: declines an invitation by ID from the in-app Invites tab. Only for
     * the signed-in account it was sent to. */
    @UseGuards(JWTAccessTokenGuard)
    @Post(':invitationID/decline')
    invitationDeclineByID(@Param('invitationID') invitationID: string, @GetAccountData('account') account: Account) {
        return this.invitationService.declineInviteByID(invitationID, account.id);
    }

    /** `POST /invitation/preview`: the public details of an invitation, shown before the invitee accepts or declines.
     * No sign-in needed. The token comes in the body, not the URL, so request logs can't record it. */
    @Post('preview')
    invitationPreview(@Body() data: InvitationTokenDTO) {
        return this.invitationService.preview(data.invitationToken);
    }

    /** `GET /invitation/account`: the signed-in account's own pending invitations, for the in-app Invites tab. */
    @UseGuards(JWTAccessTokenGuard)
    @Get('account')
    invitationReadAccountAll(@GetAccountData('account') account: Account) {
        return this.invitationService.readAccountAll(account);
    }

    /** `GET /invitation/organization/:organizationID`: the organization's pending invitations. organization:admin of
     * it, or a platform admin or agent. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(organizationManagerRoles, 'organizationID')
    @Get('organization/:organizationID')
    invitationReadOrganizationAll(@Param('organizationID') organizationID: string) {
        return this.invitationService.readOrganizationAll(organizationID);
    }

    /** `POST /invitation/:invitationID/revoke`: cancels a pending invitation. A platform admin or agent, or
     * organization:admin of the invitation's organization; checked inside `InvitationService.revoke`, since it depends
     * on the invitation's organization rather than a route param. */
    @UseGuards(JWTAccessTokenGuard)
    @Post(':invitationID/revoke')
    invitationRevokeOne(@Param('invitationID') invitationID: string, @GetAccountData('account') account: Account) {
        return this.invitationService.revoke(invitationID, account.id);
    }
}
