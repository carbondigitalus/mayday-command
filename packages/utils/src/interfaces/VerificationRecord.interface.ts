// Custom Modules
import VerificationProvider from '../enums/VerificationProvider.enum';
import VerificationStatus from '../enums/VerificationStatus.enum';

export default interface VerificationRecord {
    provider: VerificationProvider;
    status: VerificationStatus;
    verifiedOn?: Date;
}
