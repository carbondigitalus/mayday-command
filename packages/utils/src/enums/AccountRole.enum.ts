/** The role an account holds. Defined in code rather than the database, so a fresh install needs no seeded data,
 * and shared with the portal so it can show or hide parts of the app by role. An account holds one role. Each value
 * is `'area:role'`: `platform` roles run the install, and `organization` roles belong to a customer organization. */
enum AccountRole {
    /** A customer organization's administrator. */
    OrganizationAdmin = 'organization:admin',
    /** A customer within an organization. */
    OrganizationMember = 'organization:member',
    /** Runs the install: manages agents and settings. */
    PlatformAdmin = 'platform:admin',
    /** Works tickets. */
    PlatformAgent = 'platform:agent'
}

export default AccountRole;
