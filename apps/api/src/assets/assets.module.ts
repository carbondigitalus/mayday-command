// NPM Modules
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Custom Modules
import AssetsController from './assets.controller';
import AssetsService from './assets.service';
import StorageService from './storage.service';
import Account from 'src/database/account.entity';
import Asset from 'src/database/asset.entity';
import Organization from 'src/database/organization.entity';

/** Files people upload: organization logos now, ticket attachments later. Every file lives in one private,
 * S3-compatible bucket and is served only through short-lived signed links. */
@Module({
    controllers: [AssetsController],
    exports: [AssetsService, StorageService, TypeOrmModule],
    imports: [TypeOrmModule.forFeature([Account, Asset, Organization])],
    providers: [AssetsService, StorageService]
})
export default class AssetsModule {}
