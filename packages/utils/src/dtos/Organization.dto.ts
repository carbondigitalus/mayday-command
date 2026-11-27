// NPM Modules
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import 'reflect-metadata';

// Custom Modules
import Account from './Account.dto';
import Asset from './Asset.dto';

/** A customer organization. Accounts belong to it through their {@link Account.organizationList}. */
export default class Organization {
    @IsNotEmpty()
    id?: string;

    @IsString()
    @IsNotEmpty()
    name?: string;

    /** The organization's logo, or null until one is uploaded. */
    logo?: Asset | null;

    @IsBoolean()
    isActive?: boolean;

    createdOn?: Date;
    updatedOn?: Date;

    /** Every {@link Account} that belongs to this organization. */
    accountList?: Account[];
}
