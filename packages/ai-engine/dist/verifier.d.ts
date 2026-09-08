import { NormalizedFinding, FindingStatus, ScannerResult } from '@maverick006/types';
import { SecurityScanner } from '@maverick006/security-engine';
export interface VerificationRequest {
    finding: NormalizedFinding;
    codeFix: string;
    originalFileContent?: string;
    scanner: SecurityScanner;
    filePath: string;
}
export interface VerificationResult {
    originalFinding: NormalizedFinding;
    status: FindingStatus.VERIFIED | FindingStatus.FAILED_VERIFICATION | FindingStatus.NOT_VERIFIED;
    message: string;
    reScanResult?: ScannerResult;
}
/**
 * Rescan Verification Engine:
 * Validates AI-suggested code fixes by applying them in an isolated workspace
 * and executing the deterministic scanner to verify the vulnerability is actually gone.
 */
export declare class RescanVerifier {
    verifyPatch(request: VerificationRequest): Promise<VerificationResult>;
}
//# sourceMappingURL=verifier.d.ts.map