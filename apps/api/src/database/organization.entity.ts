// NPM Modules
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { Column, CreateDateColumn, Entity, ManyToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import 'reflect-metadata';

// Custom Modules
import Account from './account.entity';

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

    /** URL of the organization's logo image. */
    @Column({ nullable: true, default: null })
    @IsString()
    logo?: string;

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
