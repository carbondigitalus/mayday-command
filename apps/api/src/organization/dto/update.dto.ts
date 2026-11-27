// NPM Modules
import { OmitType, PartialType } from '@nestjs/mapped-types';

// Custom Modules
import Organization from 'src/database/organization.entity';

/** Every editable Organization field optional, matching this codebase's PATCH convention. `id` is never accepted, so
 * a body can't redirect the update to another organization; `isActive` changes only through deactivation, and `logo`
 * only through the logo upload. */
export default class OrganizationUpdateDTO extends PartialType(OmitType(Organization, ['id', 'isActive', 'logo'])) {}
