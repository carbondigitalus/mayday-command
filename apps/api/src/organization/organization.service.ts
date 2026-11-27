// NPM Modules
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Shared Modules
import { platformRoles } from '@mayday-command/utils/constants/roles.constants';
import AccountRole from '@mayday-command/utils/enums/AccountRole.enum';

// Custom Modules
import OrganizationCreateDTO from './dto/create.dto';
import OrganizationUpdateDTO from './dto/update.dto';
import AccountService from 'src/account/account.service';
import Account from 'src/database/account.entity';
import Organization from 'src/database/organization.entity';
import FileUploadService from 'src/file/file-upload.service';
import LoggerService from 'src/logger/logger.service';

/** CRUD for Organization, including the creator joining what they create. */
@Injectable()
export default class OrganizationService {
    /** The account and organization repositories, plus the account, file upload and logger services. */
    constructor(
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(Organization)
        private organizationRepository: Repository<Organization>,
        private accountService: AccountService,
        private fileService: FileUploadService,
        private logger: LoggerService
    ) {}

    /** Creates the organization. A platform admin or agent creates it without joining, then invites its admin. Anyone
     * else joins it, and becomes `organization:admin` if they have no role yet; an existing role never changes. */
    async create(data: OrganizationCreateDTO, creator: Account) {
        const logContext = 'OrganizationService-create';

        const organization = this.organizationRepository.create({ name: data.name });

        const savedOrganization = await this.organizationRepository.save(organization);

        if (!creator.role || !platformRoles.includes(creator.role)) {
            await this.accountService.assignRole(creator.id, AccountRole.OrganizationAdmin, savedOrganization.id);
        }

        this.logger.debug(
            `Organization created successfully: ${savedOrganization.name} (ID: ${savedOrganization.id})`,
            logContext
        );

        return savedOrganization;
    }

    /** Soft-delete: sets `isActive` false, matching this codebase's other resources. */
    async delete(id: string) {
        const logContext = 'OrganizationService-delete';

        const updatedOrganization = await this.organizationRepository.preload({ id, isActive: false });

        if (!updatedOrganization) {
            this.logger.warn(`Organization deletion attempt failed: Organization not found for ID: ${id}`, logContext);
            throw new NotFoundException('Organization not found.');
        }

        const result = await this.organizationRepository.save(updatedOrganization);

        this.logger.debug(`Organization deactivated successfully: ${id}`, logContext);

        return result;
    }

    /** The active organizations `account` may see: every one for a platform admin or agent, otherwise only the ones it
     * belongs to, so one customer can't list another customer's organizations. */
    async readAll(account: Account) {
        const logContext = 'OrganizationService-readAll';

        const isPlatformRole = !!account.role && platformRoles.includes(account.role);

        const organizationList = await this.organizationRepository.find({
            where: isPlatformRole ? { isActive: true } : { isActive: true, accountList: { id: account.id } }
        });

        this.logger.debug(
            `Retrieved ${organizationList.length} active organization(s) for account ${account.id}`,
            logContext
        );

        return organizationList;
    }

    /** The organization's members, with their roles, ordered by name. Only the fields a member list needs are
     * returned. */
    async readMembers(organizationID: string) {
        const logContext = 'OrganizationService-readMembers';

        const memberList = await this.accountRepository.find({
            where: { organizationList: { id: organizationID } },
            select: { id: true, email: true, firstName: true, lastName: true, role: true },
            order: { lastName: 'ASC', firstName: 'ASC' }
        });

        this.logger.debug(`Retrieved ${memberList.length} member(s) for organization ${organizationID}`, logContext);

        return memberList;
    }

    /** A single organization by id. */
    async readOne(id: string) {
        const logContext = 'OrganizationService-readOne';

        const organization = await this.organizationRepository.findOne({
            where: { id }
        });

        if (!organization) {
            this.logger.warn(`Organization not found with ID: ${id}`, logContext);
            throw new NotFoundException('Organization not found.');
        }

        this.logger.debug(`Organization retrieved successfully: ${organization.name} (ID: ${id})`, logContext);

        return organization;
    }

    /** Removes `accountID` from the organization. Anyone allowed to manage the organization may do it, including an
     * organization admin removing themselves, but the organization must keep at least one organization admin. The
     * organization's row is locked for the length of the check, so two admins removing each other at once can't
     * leave it with none. The account's role doesn't change.
     * @throws NotFoundException when the organization doesn't exist or the account isn't a member.
     * @throws ForbiddenException when it would remove the organization's last admin. */
    async removeMember(organizationID: string, accountID: string) {
        const logContext = 'OrganizationService-removeMember';

        await this.organizationRepository.manager.transaction(async (manager) => {
            const organization = await manager.findOne(Organization, {
                where: { id: organizationID },
                lock: { mode: 'pessimistic_write' }
            });

            if (!organization) {
                this.logger.warn(`Member removal failed: Organization not found for ID: ${organizationID}`, logContext);
                throw new NotFoundException('Organization not found.');
            }

            const member = await manager.findOne(Account, {
                where: { id: accountID, organizationList: { id: organizationID } }
            });

            if (!member) {
                this.logger.warn(
                    `Member removal failed: Account ${accountID} isn't a member of ${organizationID}`,
                    logContext
                );
                throw new NotFoundException('That account is not a member of this organization.');
            }

            if (member.role === AccountRole.OrganizationAdmin) {
                const adminCount = await manager.count(Account, {
                    where: { role: AccountRole.OrganizationAdmin, organizationList: { id: organizationID } }
                });

                if (adminCount <= 1) {
                    this.logger.warn(
                        `Member removal refused: ${accountID} is the last admin of ${organizationID}`,
                        logContext
                    );
                    throw new ForbiddenException('An organization must keep at least one admin.');
                }
            }

            await manager
                .createQueryBuilder()
                .relation(Account, 'organizationList')
                .of(accountID)
                .remove(organizationID);
        });

        this.logger.debug(`Account ${accountID} removed from organization ${organizationID}`, logContext);

        return { status: 'success' };
    }

    /** Requires organization:admin on `id`, enforced by the controller's RolesGuard. */
    async update(id: string, data: OrganizationUpdateDTO) {
        const logContext = 'OrganizationService-update';

        const updatedOrganization = await this.organizationRepository.preload({ ...data, id });

        if (!updatedOrganization) {
            this.logger.warn(`Organization update attempt failed: Organization not found for ID: ${id}`, logContext);
            throw new NotFoundException('Organization not found.');
        }

        const result = await this.organizationRepository.save(updatedOrganization);

        this.logger.debug(`Organization updated successfully: ${id}`, logContext);

        return result;
    }

    /** Requires organization:admin on `id`, enforced by the controller's RolesGuard.
     * Stored as `organization-logo-<id>.png` (see `FileUploadService.fileUploadLogo`),
     * and `logo` holds that blob name. */
    async uploadLogo(id: string, file: Express.Multer.File) {
        const logContext = 'OrganizationService-uploadLogo';

        const organization = await this.organizationRepository.findOne({
            where: { id }
        });

        if (!organization) {
            this.logger.warn(`Logo upload failed: Organization not found for ID: ${id}`, logContext);
            throw new NotFoundException('Organization not found.');
        }

        const fileName = await this.fileService.fileUploadLogo(file, id, 'organization');

        const updatedOrganization = await this.organizationRepository.preload({
            id: organization.id,
            logo: fileName.toString()
        });

        const result = await this.organizationRepository.save(updatedOrganization);

        this.logger.debug(`Organization logo updated successfully for: ${organization.name} (ID: ${id})`, logContext);

        return result;
    }
}
