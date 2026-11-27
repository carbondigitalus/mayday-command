// NPM Modules
import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UploadedFile,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

// Shared Modules
import { organizationManagerRoles } from '@mayday-command/utils/constants/roles.constants';
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import OrganizationService from './organization.service';
import OrganizationCreateDTO from './dto/create.dto';
import OrganizationUpdateDTO from './dto/update.dto';
import Account from 'src/database/account.entity';
import GetAccountData from 'src/utils/decorators/GetAccountData.decorator';
import RequiresRole from 'src/utils/decorators/RequiresRole.decorator';
import JWTAccessTokenGuard from 'src/utils/guards/JWTAccessTokenGuard.guard';
import RolesGuard from 'src/utils/guards/RolesGuard.guard';

/** Route /organization */
@UseInterceptors(ClassSerializerInterceptor)
@Controller('organization')
export default class OrganizationController {
    constructor(private organizationService: OrganizationService) {}

    /** `POST /organization`: creates an organization. Any signed-in account; a platform admin or agent doesn't join
     * it, and anyone else joins it, becoming organization:admin if they have no role yet. */
    @UseGuards(JWTAccessTokenGuard)
    @Post()
    organizationCreateOne(@Body() data: OrganizationCreateDTO, @GetAccountData('account') creator: Account) {
        return this.organizationService.create(data, creator);
    }

    /** `DELETE /organization/:organizationID`: deactivates the organization. organization:admin of it, or a platform
     * admin or agent. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(organizationManagerRoles, 'organizationID')
    @Delete(':organizationID')
    organizationDeleteOne(@Param('organizationID') organizationID: string) {
        return this.organizationService.delete(organizationID);
    }

    /** `GET /organization`: every active organization for a platform admin or agent; anyone else sees only the ones
     * they belong to. */
    @UseGuards(JWTAccessTokenGuard)
    @Get()
    organizationReadAll(@GetAccountData('account') account: Account) {
        return this.organizationService.readAll(account);
    }

    /** `GET /organization/:organizationID/member`: the organization's members and their roles. organization:admin of
     * it, or a platform admin or agent. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(organizationManagerRoles, 'organizationID')
    @Get(':organizationID/member')
    organizationReadMembers(@Param('organizationID') organizationID: string) {
        return this.organizationService.readMembers(organizationID);
    }

    /** `GET /organization/:organizationID`: one organization. Any role, but an organization role must belong to it;
     * platform roles reach every one. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(Object.values(AccountRole), 'organizationID')
    @Get(':organizationID')
    organizationReadOne(@Param('organizationID') organizationID: string) {
        return this.organizationService.readOne(organizationID);
    }

    /** `DELETE /organization/:organizationID/member/:accountID`: removes a member, including an organization admin
     * removing themselves, but never the organization's last admin. organization:admin of it, or a platform admin or
     * agent. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(organizationManagerRoles, 'organizationID')
    @Delete(':organizationID/member/:accountID')
    organizationRemoveMember(@Param('organizationID') organizationID: string, @Param('accountID') accountID: string) {
        return this.organizationService.removeMember(organizationID, accountID);
    }

    /** `PATCH /organization/:organizationID`: updates the organization's name. organization:admin of it, or a platform
     * admin or agent. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(organizationManagerRoles, 'organizationID')
    @Patch(':organizationID')
    organizationUpdateOne(@Param('organizationID') organizationID: string, @Body() data: OrganizationUpdateDTO) {
        return this.organizationService.update(organizationID, data);
    }

    /** `POST /organization/upload/logo/:organizationID`: uploads the organization's logo. organization:admin of it, or
     * a platform admin or agent. */
    @UseGuards(JWTAccessTokenGuard, RolesGuard)
    @RequiresRole(organizationManagerRoles, 'organizationID')
    @Post('upload/logo/:organizationID')
    @UseInterceptors(FileInterceptor('file'))
    organizationUploadLogo(@Param('organizationID') organizationID: string, @UploadedFile() file: Express.Multer.File) {
        return this.organizationService.uploadLogo(organizationID, file);
    }
}
