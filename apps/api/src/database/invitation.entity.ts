// NPM Modules
import { IsDate, IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import 'reflect-metadata';

// Shared Modules
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';
import InvitationStatus from '@mayday-command/utils/enums/InvitationStatus.enum';

// Custom Modules
import Account from './account.entity';
import Organization from './organization.entity';

/** An offer of a role, optionally into an organization, sent to an email address that may not have an Account yet.
 * Accepting it adds the account to the organization, and gives it the role only if it has none. */
@Entity()
export default class Invitation {
    /** Primary key. */
    @PrimaryGeneratedColumn('uuid')
    @IsNotEmpty()
    id: string;

    /** Email address the invitation was sent to. */
    @Column()
    @IsEmail()
    @IsNotEmpty()
    invitedEmail: string;

    /** Lifecycle state of this invitation. */
    @Column({
        type: 'enum',
        enum: InvitationStatus,
        default: InvitationStatus.Pending
    })
    status: InvitationStatus;

    /** When this invitation stops being redeemable. */
    @Column({ type: 'timestamp' })
    @IsDate()
    expiresAt: Date;

    /** The account that sent this invitation. Column saved in db will be `invitedById`. */
    @ManyToOne(() => Account, { cascade: true })
    @JoinColumn()
    invitedBy: Account;

    /** The role offered: an organization role for an organization invitation, a platform role otherwise. */
    @Column({ type: 'enum', enum: AccountRole })
    @IsEnum(AccountRole)
    role: AccountRole;

    /** The organization the invitee joins on accepting. Null for a platform invitation. Column saved in db will be
     * `organizationId`. */
    @ManyToOne(() => Organization, { nullable: true })
    @JoinColumn()
    organization?: Organization;

    /** Timestamp this invitation was created. */
    @CreateDateColumn()
    createdOn: Date;

    /** Timestamp this invitation was last updated. */
    @UpdateDateColumn()
    updatedOn: Date;
}
