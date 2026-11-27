// Custom Modules
import VerificationRecord from './VerificationRecord.interface';

export default interface AccountVerifications {
    email?: VerificationRecord;
    phone?: VerificationRecord;
}
