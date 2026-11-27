// NPM Modules
import { InjectQueue } from '@nestjs/bullmq';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { FindOptionsSelect, In, IsNull, MoreThan, Not, Repository } from 'typeorm';

// Shared Modules
import { platformRoles } from '@mayday-command/utils/constants/roles.constants';
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';
import InvitationStatus from '@mayday-command/utils/enums/InvitationStatus.enum';

// Custom Modules
import InvitationCreateDTO from './dto/create.dto';
import AccountService from 'src/account/account.service';
import AuthService from 'src/auth/auth.service';
import Account from 'src/database/account.entity';
import Invitation from 'src/database/invitation.entity';
import Organization from 'src/database/organization.entity';
import LoggerService from 'src/logger/logger.service';

/** How long a newly-created invitation stays redeemable. The one source for its lifetime: the stored `expiresAt` and
 * the emailed token's own expiry both come from it. */
const invitationLifetimeMS = 7 * 24 * 60 * 60 * 1000;
const invitationLifetimeDays = invitationLifetimeMS / (24 * 60 * 60 * 1000);

/** The fields an invitation list returns. The inviter is limited to their name: the rest of their account (email,
 * phone, role, login and lockout times, verification records) is never shown to invitees or other members. */
const invitationListSelect: FindOptionsSelect<Invitation> = {
    createdOn: true,
    expiresAt: true,
    id: true,
    invitedBy: { firstName: true, id: true, lastName: true },
    invitedEmail: true,
    organization: { id: true, name: true },
    role: true,
    status: true
};

/** Creates, accepts, declines and revokes invitations. The database row is the record of truth; the emailed token is
 * an encrypted, signed reference to it. */
@Injectable()
export default class InvitationService {
    /** The invitation, account and organization repositories, plus the account and auth services, the 'email'
     * queue and the logger. */
    constructor(
        @InjectRepository(Invitation)
        private invitationRepository: Repository<Invitation>,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(Organization)
        private organizationRepository: Repository<Organization>,
        private accountService: AccountService,
        private authService: AuthService,
        @InjectQueue('email') private emailQueue: Queue,
        private logger: LoggerService
    ) {}

    /** Validates `token` against its Invitation row and, when `acceptingAccountID`'s email matches the invite, adds the
     * account to the invitation's organization. The account takes the invitation's role only if it has none. */
    async accept(token: string, acceptingAccountID: string) {
        const logContext = 'InvitationService-accept';

        const invitation = await this.resolvePendingInvitation(token, logContext);

        return this.completeAcceptance(invitation, acceptingAccountID, logContext);
    }

    /** Id-based counterpart to `accept` for the authenticated in-app Invites tab, where the client doesn't have (and
     * shouldn't need) the emailed token. */
    async acceptInviteByID(invitationID: string, acceptingAccountID: string) {
        const logContext = 'InvitationService-acceptInviteByID';

        const invitation = await this.resolvePendingInvitationByID(invitationID, logContext);

        return this.completeAcceptance(invitation, acceptingAccountID, logContext);
    }

    /** Refuses an invitation that accepting couldn't act on: `invitedEmail` already belongs to the organization, or,
     * for a platform invitation, already has a role (accepting never changes an existing role; a platform admin
     * changes it instead). An email with no account yet always passes. */
    private async assertInviteNeeded(invitedEmail: string, logContext: string, organizationID?: string) {
        const alreadyCovered = await this.accountRepository.exists({
            where: organizationID
                ? { email: invitedEmail, organizationList: { id: organizationID } }
                : { email: invitedEmail, role: Not(IsNull()) }
        });

        if (alreadyCovered) {
            this.logger.warn('Invitation creation refused: The invitee already has what it offers.', logContext);
            throw new ConflictException(
                organizationID
                    ? 'That person is already a member of this organization.'
                    : 'That account already has a role. Change it from the account admin tools instead.'
            );
        }
    }

    /** Loads `accountID` and checks it's the account the invitation was sent to, by email.
     * @throws NotFoundException when the account doesn't exist.
     * @throws ForbiddenException when its email isn't the invited one. */
    private async assertInvitee(invitation: Invitation, accountID: string, logContext: string) {
        const account = await this.accountRepository.findOne({ where: { id: accountID } });

        if (!account) {
            this.logger.warn(`Invitation response failed: Account not found for ID: ${accountID}`, logContext);
            throw new NotFoundException('Account not found.');
        }

        if (account.email !== invitation.invitedEmail) {
            this.logger.warn(
                `Invitation response failed: Account email does not match invited email for invitation ${invitation.id}`,
                logContext
            );
            throw new ForbiddenException('This invitation was sent to a different email address.');
        }
    }

    /** Shared by both the token-based and id-based lookups: 404s when the row doesn't exist, and 403s when it's no
     * longer Pending or has passed `expiresAt`. A pending invitation found expired is marked `Expired` on the way, so
     * its status matches reality from then on. */
    private async assertPending(
        invitation: Invitation | null,
        invitationID: string,
        logContext: string
    ): Promise<Invitation> {
        if (!invitation) {
            this.logger.warn(`Invitation resolution failed: Invitation not found for ID: ${invitationID}`, logContext);
            throw new NotFoundException('Invitation not found.');
        }

        if (invitation.status !== InvitationStatus.Pending) {
            this.logger.warn(
                `Invitation resolution failed: Invitation ${invitation.id} is not pending (status: ${invitation.status})`,
                logContext
            );
            throw new ForbiddenException('This invitation is no longer valid.');
        }

        if (invitation.expiresAt <= new Date()) {
            await this.invitationRepository.update(invitation.id, { status: InvitationStatus.Expired });

            this.logger.warn(`Invitation resolution failed: Invitation ${invitation.id} has expired`, logContext);
            throw new ForbiddenException('This invitation has expired. Please request a new one.');
        }

        return invitation;
    }

    /** The shared second half of `accept` and `acceptInviteByID`: checks the account is the invitee, applies the
     * invitation's role and organization through `AccountService.assignRole`, and marks it `Accepted`. */
    private async completeAcceptance(invitation: Invitation, accountID: string, logContext: string) {
        await this.assertInvitee(invitation, accountID, logContext);

        await this.accountService.assignRole(accountID, invitation.role, invitation.organization?.id);

        return this.setStatus(invitation, InvitationStatus.Accepted, logContext);
    }

    /** Creates the Invitation row (the source of truth), signs a token referencing it, and queues the invite email.
     * Refuses an invitation that couldn't do anything: one to an existing member of the organization, or a platform
     * invitation to an account that already has a role. Any still-pending invitation for the same email and
     * organization is revoked first, so sending again works as "resend". The token goes only into the email, never
     * into this response; to send the link again, create the invitation again.
     * @throws ConflictException when the invitee is already a member, or already has a role for a platform
     * invitation. */
    async create(invitedByAccountID: string, data: InvitationCreateDTO, organizationID?: string) {
        const logContext = 'InvitationService-create';

        const invitedBy = await this.accountRepository.findOne({
            where: { id: invitedByAccountID }
        });

        if (!invitedBy) {
            this.logger.warn(
                `Invitation creation attempt failed: Account not found for ID: ${invitedByAccountID}`,
                logContext
            );
            throw new NotFoundException('Account not found.');
        }

        const isPlatformRole = platformRoles.includes(data.role);

        if (organizationID ? isPlatformRole : !isPlatformRole) {
            this.logger.warn(
                `Invitation creation attempt failed: ${data.role} doesn't match the invitation's scope`,
                logContext
            );
            throw new BadRequestException(
                organizationID
                    ? 'An organization invitation must offer an organization role.'
                    : 'A platform invitation must offer a platform role.'
            );
        }

        let organization: Organization | undefined;
        if (organizationID) {
            const foundOrganization = await this.organizationRepository.findOne({ where: { id: organizationID } });

            if (!foundOrganization) {
                this.logger.warn(
                    `Invitation creation attempt failed: Organization not found for ID: ${organizationID}`,
                    logContext
                );
                throw new NotFoundException('Organization not found.');
            }

            organization = foundOrganization;
        }

        const invitedEmail = data.invitedEmail.toLowerCase();

        await this.assertInviteNeeded(invitedEmail, logContext, organizationID);
        await this.revokeStalePending(invitedEmail, organizationID);

        const expiresAt = new Date(Date.now() + invitationLifetimeMS);

        const invitation = this.invitationRepository.create({
            invitedEmail,
            invitedBy,
            role: data.role,
            organization,
            status: InvitationStatus.Pending,
            expiresAt
        });

        const savedInvitation = await this.invitationRepository.save(invitation);

        const { invitationToken } = await this.authService.generateTokenInvitation(savedInvitation.id, expiresAt);

        await this.emailQueue.add('invitation-email', {
            email: savedInvitation.invitedEmail,
            inviterFirstName: invitedBy.firstName,
            inviterLastName: invitedBy.lastName,
            roleLabel: data.role,
            organizationName: organization?.name,
            invitationToken,
            expiresInDays: invitationLifetimeDays
        });

        this.logger.debug(`Invitation ${savedInvitation.id} created: ${data.role}`, logContext);

        return { invitation: savedInvitation };
    }

    /** Decodes `token` and marks its Invitation `Declined`. Requires no authentication: an invitee may not have an
     * account yet, and holding the emailed token is itself the authorization. */
    async decline(token: string) {
        const logContext = 'InvitationService-decline';

        const invitation = await this.resolvePendingInvitation(token, logContext);

        return this.setStatus(invitation, InvitationStatus.Declined, logContext);
    }

    /** Id-based counterpart to `decline` for the authenticated in-app Invites tab. Unlike the public token-based
     * `decline`, where holding the token is itself the authorization, this requires the requesting account's email to
     * match the invite; otherwise any signed-in account could decline someone else's invitation by guessing its ID. */
    async declineInviteByID(invitationID: string, requestingAccountID: string) {
        const logContext = 'InvitationService-declineInviteByID';

        const invitation = await this.resolvePendingInvitationByID(invitationID, logContext);

        await this.assertInvitee(invitation, requestingAccountID, logContext);

        return this.setStatus(invitation, InvitationStatus.Declined, logContext);
    }

    /** Decodes `invitationToken` and returns the public-safe details of the
     * invitation it references, for display before the invitee decides
     * whether to accept or decline. Requires no authentication. */
    async preview(invitationToken: string) {
        const invitation = await this.resolvePendingInvitation(invitationToken, 'InvitationService-preview');

        return {
            inviterFirstName: invitation.invitedBy.firstName,
            inviterLastName: invitation.invitedBy.lastName,
            role: invitation.role,
            organizationName: invitation.organization?.name,
            invitedEmail: invitation.invitedEmail
        };
    }

    /** Every Pending, unexpired invitation addressed to the signed-in `account`'s email: its own "my invitations"
     * list, for the in-app Invites tab. The account always comes from the session, never the request, so no one can
     * read another account's invitations. */
    async readAccountAll(account: Account) {
        const logContext = 'InvitationService-readAccountAll';

        const invitationList = await this.invitationRepository.find({
            where: {
                expiresAt: MoreThan(new Date()),
                invitedEmail: account.email,
                status: InvitationStatus.Pending
            },
            relations: { invitedBy: true, organization: true },
            select: invitationListSelect
        });

        this.logger.debug(
            `Retrieved ${invitationList.length} pending invitation(s) for account ${account.id}`,
            logContext
        );

        return invitationList;
    }

    /** Every Pending, unexpired invitation scoped to `organizationID`: the organization's pending-invite roster. */
    async readOrganizationAll(organizationID: string) {
        const logContext = 'InvitationService-readOrganizationAll';

        const invitationList = await this.invitationRepository.find({
            where: {
                expiresAt: MoreThan(new Date()),
                organization: { id: organizationID },
                status: InvitationStatus.Pending
            },
            relations: { invitedBy: true },
            select: invitationListSelect
        });

        this.logger.debug(
            `Retrieved ${invitationList.length} pending invitation(s) for organization ${organizationID}`,
            logContext
        );

        return invitationList;
    }

    /** Decodes `token`, loads its Invitation row (with `organization` and
     * `invitedBy` populated), and asserts it is still
     * `Pending` — the shared groundwork for `accept`, `decline`, and
     * `preview`. */
    private async resolvePendingInvitation(token: string, logContext: string): Promise<Invitation> {
        const decodedToken = await this.authService.decodeTokenInvitation(token);

        const invitation = await this.invitationRepository.findOne({
            where: { id: decodedToken.sub },
            relations: { invitedBy: true, organization: true }
        });

        return this.assertPending(invitation, decodedToken.sub, logContext);
    }

    /** Loads the Invitation row named by `invitationID` directly (no
     * token to decode) and asserts it is still `Pending` — the id-based
     * counterpart to `resolvePendingInvitation`, for the authenticated
     * in-app accept/decline/list paths. */
    private async resolvePendingInvitationByID(invitationID: string, logContext: string): Promise<Invitation> {
        const invitation = await this.invitationRepository.findOne({
            where: { id: invitationID },
            relations: { invitedBy: true, organization: true }
        });

        return this.assertPending(invitation, invitationID, logContext);
    }

    /** Cancels a still-Pending invitation. Requires a platform admin or agent, or organization:admin belonging to the
     * invitation's organization. (An invitee who wants out already has `decline`.) */
    async revoke(invitationID: string, requestingAccountID: string) {
        const logContext = 'InvitationService-revoke';

        const invitation = await this.invitationRepository.findOne({
            where: { id: invitationID },
            relations: { organization: true }
        });

        if (!invitation) {
            this.logger.warn(
                `Invitation revoke attempt failed: Invitation not found for ID: ${invitationID}`,
                logContext
            );
            throw new NotFoundException('Invitation not found.');
        }

        if (invitation.status !== InvitationStatus.Pending) {
            this.logger.warn(
                `Invitation revoke attempt failed: Invitation ${invitationID} is not pending (status: ${invitation.status})`,
                logContext
            );
            throw new ForbiddenException('This invitation is no longer valid.');
        }

        const requestingAccount = await this.accountRepository.findOne({ where: { id: requestingAccountID } });

        const isPlatformRole = !!requestingAccount?.role && platformRoles.includes(requestingAccount.role);
        const isOrgAdmin =
            requestingAccount?.role === AccountRole.OrganizationAdmin &&
            !!invitation.organization &&
            (await this.accountRepository.exists({
                where: { id: requestingAccountID, organizationList: { id: invitation.organization.id } }
            }));

        if (!isPlatformRole && !isOrgAdmin) {
            this.logger.warn(
                `Invitation revoke attempt failed: account ${requestingAccountID} may not revoke invitation ${invitationID}`,
                logContext
            );
            throw new ForbiddenException('You do not have permission to revoke this invitation.');
        }

        const updatedInvitation = await this.invitationRepository.preload({
            id: invitation.id,
            status: InvitationStatus.Revoked
        });
        await this.invitationRepository.save(updatedInvitation);

        this.logger.debug(`Invitation ${invitation.id} revoked by account ${requestingAccountID}`, logContext);

        return { status: InvitationStatus.Revoked };
    }

    /** Revokes every still-pending invitation for `invitedEmail` to the same organization (or, with none, the same
     * platform scope), so a new invitation replaces it rather than sitting beside it. */
    private async revokeStalePending(invitedEmail: string, organizationID?: string) {
        const staleList = await this.invitationRepository.find({
            where: {
                invitedEmail,
                organization: organizationID ? { id: organizationID } : IsNull(),
                status: InvitationStatus.Pending
            },
            select: { id: true }
        });

        if (staleList.length > 0) {
            await this.invitationRepository.update(
                { id: In(staleList.map((invitation) => invitation.id)) },
                { status: InvitationStatus.Revoked }
            );
        }
    }

    /** Moves the invitation to `status` and returns that status, the response every accept and decline route gives. */
    private async setStatus(invitation: Invitation, status: InvitationStatus, logContext: string) {
        const updatedInvitation = await this.invitationRepository.preload({ id: invitation.id, status });
        await this.invitationRepository.save(updatedInvitation);

        this.logger.debug(`Invitation ${invitation.id} marked ${status}`, logContext);

        return { status };
    }
}
