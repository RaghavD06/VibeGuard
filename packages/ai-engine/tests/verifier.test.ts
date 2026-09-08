import { RescanVerifier } from '../src/verifier';
import { SecurityScanner } from '@maverick006/security-engine';
import { NormalizedFinding, Severity, ScannerState, FindingStatus } from '@maverick006/types';

describe('Rescan Verification Engine', () => {
  const verifier = new RescanVerifier();

  const mockFinding: NormalizedFinding = {
    scanner: 'MockScanner',
    ruleId: 'vulnerable-sql-query',
    title: 'SQL Injection Vulnerability',
    description: 'Direct string concatenation in query',
    severity: Severity.CRITICAL,
    file: 'db/users.ts',
    line: 14
  };

  it('should mark finding as VERIFIED when rescan no longer finds the vulnerability', async () => {
    // Scanner that reports 0 findings on the patched file
    const mockScanner: SecurityScanner = {
      name: 'MockScanner',
      scan: async () => ({
        scanner: 'MockScanner',
        success: true,
        state: ScannerState.SUCCESS,
        findings: [],
        startTime: new Date(),
        endTime: new Date()
      })
    };

    const result = await verifier.verifyPatch({
      finding: mockFinding,
      codeFix: 'const user = await db.query("SELECT * FROM users WHERE id = $1", [userId]);',
      scanner: mockScanner,
      filePath: 'db/users.ts'
    });

    expect(result.status).toBe(FindingStatus.VERIFIED);
    expect(result.message).toContain('confirmed the vulnerability is resolved');
  });

  it('should mark finding as FAILED_VERIFICATION if rescan still detects the issue', async () => {
    // Scanner that still flags the vulnerability
    const mockScanner: SecurityScanner = {
      name: 'MockScanner',
      scan: async () => ({
        scanner: 'MockScanner',
        success: true,
        state: ScannerState.SUCCESS,
        findings: [mockFinding],
        startTime: new Date(),
        endTime: new Date()
      })
    };

    const result = await verifier.verifyPatch({
      finding: mockFinding,
      codeFix: 'const user = await db.query("SELECT * FROM users WHERE id = " + userId);',
      scanner: mockScanner,
      filePath: 'db/users.ts'
    });

    expect(result.status).toBe(FindingStatus.FAILED_VERIFICATION);
    expect(result.message).toContain('still flagged the vulnerability');
  });

  it('should handle empty code fix gracefully with NOT_VERIFIED', async () => {
    const mockScanner: SecurityScanner = {
      name: 'MockScanner',
      scan: async () => ({
        scanner: 'MockScanner',
        success: true,
        findings: [],
        startTime: new Date(),
        endTime: new Date()
      })
    };

    const result = await verifier.verifyPatch({
      finding: mockFinding,
      codeFix: '',
      scanner: mockScanner,
      filePath: 'db/users.ts'
    });

    expect(result.status).toBe(FindingStatus.NOT_VERIFIED);
  });
});
