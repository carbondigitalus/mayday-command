// Custom Modules
import TokenData from './TokenData.interface';

export default interface MFAChallengeTokenData extends TokenData {
    challengeID: string;
}
