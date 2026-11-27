/** The state of one verification record. A record exists only once verification succeeds, so `Verified` is the only
 * state; an unverified address simply has no record. */
enum VerificationStatus {
    Verified = 'verified'
}
export default VerificationStatus;
