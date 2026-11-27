/** Lifecycle state of an {@link Invitation}. */
enum InvitationStatus {
    Accepted = 'accepted',
    Declined = 'declined',
    Expired = 'expired',
    Pending = 'pending',
    Revoked = 'revoked'
}

export default InvitationStatus;
