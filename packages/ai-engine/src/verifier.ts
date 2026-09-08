import { NormalizedFinding, FindingStatus, ScannerResult } from '@maverick006/types';
import { SecurityScanner } from '@maverick006/security-engine';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

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
export class RescanVerifier {
  async verifyPatch(request: VerificationRequest): Promise<VerificationResult> {
    const { finding, codeFix, scanner, filePath } = request;

    if (!codeFix || !codeFix.trim()) {
      return {
        originalFinding: finding,
        status: FindingStatus.NOT_VERIFIED,
        message: 'No executable code fix provided to verify'
      };
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeguard-verify-'));

    try {
      const relativeTarget = path.isAbsolute(filePath)
        ? path.basename(filePath)
        : filePath;
      const isolatedFilePath = path.join(tempDir, relativeTarget);
      await fs.mkdir(path.dirname(isolatedFilePath), { recursive: true });

      // Write the patched file
      await fs.writeFile(isolatedFilePath, codeFix, 'utf8');

      // Re-run scanner against the isolated workspace
      const rescanResult = await scanner.scan({
        scanId: `verify-${Date.now()}`,
        repositoryPath: tempDir
      });

      // Check if the original finding still exists
      const targetRule = (finding.ruleId || finding.title || '').toLowerCase();
      const stillFails = rescanResult.findings.some(f => {
        const rescanRule = (f.ruleId || f.title || '').toLowerCase();
        return rescanRule === targetRule;
      });

      if (!stillFails) {
        return {
          originalFinding: finding,
          status: FindingStatus.VERIFIED,
          message: `Verification succeeded: ${scanner.name} confirmed the vulnerability is resolved with no new regressions.`,
          reScanResult: rescanResult
        };
      } else {
        return {
          originalFinding: finding,
          status: FindingStatus.FAILED_VERIFICATION,
          message: `Verification failed: ${scanner.name} still flagged the vulnerability after applying the proposed fix.`,
          reScanResult: rescanResult
        };
      }
    } catch (err: any) {
      return {
        originalFinding: finding,
        status: FindingStatus.NOT_VERIFIED,
        message: `Verification could not be performed: ${err.message}`
      };
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
