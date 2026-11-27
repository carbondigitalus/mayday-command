// NPM Modules
import { Exclude } from 'class-transformer';
import { IsDate, IsNotEmpty, IsNumber } from 'class-validator';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import 'reflect-metadata';

// Shared Modules
import MFAMethod from '@mayday-command/utils/enums/MFAMethod.enum';

// Custom Modules
import Account from './account.entity';

/** One outstanding second-factor check at login: created when a password
 * checks out but the account's 2FA has lapsed, and deleted once it is passed,
 * invalidated or replaced. Lives in its own table, apart from the email
 * verification code columns on {@link Account}, so a code issued for one
 * purpose can never satisfy the other. */
@Entity()
export default class MFAChallenge {
    /** Primary key. */
    @PrimaryGeneratedColumn('uuid')
    @IsNotEmpty()
    id: string;

    /** The account being challenged. Column saved in db will be `accountID`. */
    @ManyToOne(() => Account)
    @JoinColumn()
    account: Account;

    /** How the user is proving it: the handler that issued this challenge. */
    @Column({ type: 'enum', enum: MFAMethod })
    method: MFAMethod;

    /** Argon2 hash of the code that was sent. Null for a method that has no
     * stored code (e.g. an authenticator app, which checks a shared secret). */
    @Exclude()
    @Column({ type: 'varchar', nullable: true, default: null, select: false })
    codeHash?: string | null;

    /** When the code stops being valid. */
    @Column({ type: 'timestamp' })
    @IsDate()
    expiresAt: Date;

    /** Wrong guesses so far; the challenge is invalidated at the cap. */
    @Column({ type: 'int', default: 0 })
    @IsNumber()
    attempts: number;

    /** Timestamp this challenge was issued. */
    @CreateDateColumn()
    createdOn: Date;
}
