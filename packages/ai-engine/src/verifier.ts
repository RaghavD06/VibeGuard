import { NormalizedFinding, FindingStatus, ScannerResult, ScannerState } from '@maverick006/types';
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
  constructor(private readonly timeoutMs = 120_000) {}

  private async scanWithTimeout(scanner: SecurityScanner, repositoryPath: string, scanId: string): Promise<ScannerResult> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        scanner.scan({ scanId, repositoryPath }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Verification scanner timed out')), this.timeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async verifyPatch(request: VerificationRequest): Promise<VerificationResult> {
    const { finding, codeFix, originalFileContent, scanner, filePath } = request;

    if (!codeFix || !codeFix.trim() || !originalFileContent || !originalFileContent.trim() || !filePath || filePath.includes('\0')) {
      return {
        originalFinding: finding,
        status: FindingStatus.NOT_VERIFIED,
        message: 'Both the original file content and proposed replacement are required for an isolated comparison'
      };
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeguard-verify-'));

    try {
      const relativeTarget = path.isAbsolute(filePath)
        ? path.basename(filePath)
        : filePath;
      const isolatedFilePath = path.resolve(tempDir, relativeTarget);
      if (!isolatedFilePath.startsWith(tempDir + path.sep)) {
        return {
          originalFinding: finding,
          status: FindingStatus.NOT_VERIFIED,
          message: 'Verification target must remain inside the isolated workspace'
        };
      }
      await fs.mkdir(path.dirname(isolatedFilePath), { recursive: true });

      const targetRule = (finding.ruleId || finding.title || '').toLowerCase();
      const matchesOriginal = (result: ScannerResult) => result.findings.some(f =>
        (f.ruleId || f.title || '').toLowerCase() === targetRule
      );
      await fs.writeFile(isolatedFilePath, originalFileContent, 'utf8');
      const baseline = await this.scanWithTimeout(scanner, tempDir, `baseline-${Date.now()}`);
      if (!baseline.success || baseline.state !== ScannerState.SUCCESS || !Array.isArray(baseline.findings) || !matchesOriginal(baseline)) {
        return {
          originalFinding: finding,
          status: FindingStatus.NOT_VERIFIED,
          message: `${scanner.name} could not reproduce the original finding in the isolated workspace.`
        };
      }

      // Write the proposed replacement only after reproducing the original issue.
      await fs.writeFile(isolatedFilePath, codeFix, 'utf8');

      // Re-run scanner against the isolated workspace
      const rescanResult = await this.scanWithTimeout(scanner, tempDir, `verify-${Date.now()}`);

      if (!rescanResult.success || rescanResult.state !== ScannerState.SUCCESS || !Array.isArray(rescanResult.findings)) {
        return {
          originalFinding: finding,
          status: FindingStatus.NOT_VERIFIED,
          message: `Verification could not be completed: ${scanner.name} did not finish successfully.`,
          reScanResult: rescanResult
        };
      }

      // Check if the original finding still exists
      const stillFails = matchesOriginal(rescanResult);

      if (!stillFails) {
        return {
          originalFinding: finding,
          status: FindingStatus.VERIFIED,
          message: `${scanner.name} did not find the issue in the isolated proposed file. The repository has not been changed or rescanned.`,
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
        message: err?.message === 'Verification scanner timed out'
          ? 'Verification scanner timed out; no result was verified.'
          : 'Verification scanner failed; no result was verified.'
      };
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
