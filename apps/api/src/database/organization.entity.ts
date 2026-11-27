// NPM Modules
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import 'reflect-metadata';

// Custom Modules
import Account from './account.entity';
import Asset from './asset.entity';

/** A customer organization. Accounts belong to it through {@link Account.organizationList}. */
@Entity()
export default class Organization {
    /** Primary key. */
    @PrimaryGeneratedColumn('uuid')
    @IsNotEmpty()
    id: string;

    /** Display name of the organization. */
    @Column()
    @IsString()
    @IsNotEmpty()
    name: string;

    /** The organization's logo, an uploaded {@link Asset}. Clients fetch it through `GET /asset/:assetID`. Null until
     * one is uploaded. Column saved in db will be `logoId`. */
    @ManyToOne(() => Asset, { nullable: true })
    @JoinColumn()
    logo?: Asset | null;

    /** Whether the organization is active on the platform. */
    @Column({
        type: 'boolean',
        default: true
    })
    @IsBoolean()
    isActive: boolean;

    /** Timestamp the organization was created. */
    @CreateDateColumn()
    createdOn: Date;

    /** Timestamp the organization was last updated. */
    @UpdateDateColumn()
    updatedOn: Date;

    /** Every {@link Account} that belongs to this organization. The join table is owned by `Account`. */
    @ManyToMany(() => Account, (account) => account.organizationList)
    accountList?: Account[];
}
