// NPM Modules
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Custom Modules
import OrganizationController from './organization.controller';
import OrganizationService from './organization.service';
import AccountModule from 'src/account/account.module';
import Account from 'src/database/account.entity';
import Organization from 'src/database/organization.entity';
import FileUploadService from 'src/file/file-upload.service';

/** Wires up Organization CRUD. The account repository is registered for `RolesGuard`'s membership check, and
 * `AccountModule` for the creator joining what they create. */
@Module({
    controllers: [OrganizationController],
    exports: [OrganizationService, TypeOrmModule],
    imports: [AccountModule, TypeOrmModule.forFeature([Account, Organization])],
    providers: [FileUploadService, OrganizationService]
})
export default class OrganizationModule {}
