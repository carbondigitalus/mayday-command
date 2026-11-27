// NPM Modules
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Custom Modules
import OrganizationController from './organization.controller';
import OrganizationService from './organization.service';
import AccountModule from 'src/account/account.module';
import AssetsModule from 'src/assets/assets.module';
import Account from 'src/database/account.entity';
import Organization from 'src/database/organization.entity';

/** Wires up Organization CRUD. The account repository is registered for `RolesGuard`'s membership check,
 * `AccountModule` for the creator joining what they create, and `AssetsModule` for the logo. */
@Module({
    controllers: [OrganizationController],
    exports: [OrganizationService, TypeOrmModule],
    imports: [AccountModule, AssetsModule, TypeOrmModule.forFeature([Account, Organization])],
    providers: [OrganizationService]
})
export default class OrganizationModule {}
