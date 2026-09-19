import { RescanVerifier } from '../src/verifier';
import { SecurityScanner } from '@maverick006/security-engine';
import { NormalizedFinding, Severity, ScannerState, FindingStatus } from '@maverick006/types';
import fs from 'fs/promises';
import path from 'path';

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
    // Reproduce the issue on the original file, then clear it on the proposal.
    const mockScanner: SecurityScanner = {
      name: 'MockScanner',
      scan: async input => ({
        scanner: 'MockScanner',
        success: true,
        state: ScannerState.SUCCESS,
        findings: (await fs.readFile(path.join(input.repositoryPath, 'db/users.ts'), 'utf8')).includes(' + userId') ? [mockFinding] : [],
        startTime: new Date(),
        endTime: new Date()
      })
    };

    const result = await verifier.verifyPatch({
      finding: mockFinding,
      originalFileContent: 'const query = "SELECT * FROM users WHERE id = " + userId;',
      codeFix: 'const user = await db.query("SELECT * FROM users WHERE id = $1", [userId]);',
      scanner: mockScanner,
      filePath: 'db/users.ts'
    });

    expect(result.status).toBe(FindingStatus.VERIFIED);
    expect(result.message).toContain('isolated proposed file');
  });

  it('should mark finding as FAILED_VERIFICATION if rescan still detects the issue', async () => {
    // Scanner sees the same vulnerable query before and after the proposal.
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
      originalFileContent: 'const query = "SELECT * FROM users WHERE id = " + userId;',
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
      originalFileContent: 'vulnerable original',
      codeFix: '',
      scanner: mockScanner,
      filePath: 'db/users.ts'
    });

    expect(result.status).toBe(FindingStatus.NOT_VERIFIED);
  });

  it.each([ScannerState.FAILED, ScannerState.SKIPPED, ScannerState.NOT_INSTALLED, ScannerState.TIMEOUT])('does not verify when scanner state is %s', async state => {
    const result = await verifier.verifyPatch({
      finding: mockFinding,
      originalFileContent: 'vulnerable original',
      codeFix: 'parameterized query',
      scanner: { name: 'MockScanner', scan: async () => ({ scanner: 'MockScanner', success: state !== ScannerState.FAILED, state, findings: [], startTime: new Date(), endTime: new Date() }) },
      filePath: 'db/users.ts'
    });
    expect(result.status).toBe(FindingStatus.NOT_VERIFIED);
  });

  it('rejects a relative path that escapes the isolated workspace without writing to it', async () => {
    const result = await verifier.verifyPatch({
      finding: mockFinding,
      originalFileContent: 'vulnerable original',
      codeFix: 'secret',
      scanner: { name: 'MockScanner', scan: async () => { throw new Error('scanner should not run'); } },
      filePath: '../outside.ts'
    });
    expect(result.status).toBe(FindingStatus.NOT_VERIFIED);
  });

  it('does not verify when a scanner cannot reproduce the baseline finding', async () => {
    const result = await verifier.verifyPatch({
      finding: mockFinding,
      originalFileContent: 'vulnerable original',
      codeFix: 'patched content',
      filePath: 'db/users.ts',
      scanner: { name: 'MockScanner', scan: async () => ({ scanner: 'MockScanner', success: true, state: ScannerState.SUCCESS, findings: [], startTime: new Date(), endTime: new Date() }) }
    });
    expect(result.status).toBe(FindingStatus.NOT_VERIFIED);
    expect(result.message).toContain('could not reproduce');
  });

  it('does not verify when the rescan fails after a successful baseline', async () => {
    let calls = 0;
    const result = await verifier.verifyPatch({
      finding: mockFinding,
      originalFileContent: 'vulnerable original',
      codeFix: 'patched content',
      filePath: 'db/users.ts',
      scanner: { name: 'MockScanner', scan: async () => {
        calls++;
        return { scanner: 'MockScanner', success: calls === 1, state: calls === 1 ? ScannerState.SUCCESS : ScannerState.FAILED, findings: calls === 1 ? [mockFinding] : [], startTime: new Date(), endTime: new Date() };
      } }
    });
    expect(calls).toBe(2);
    expect(result.status).toBe(FindingStatus.NOT_VERIFIED);
  });

  it('does not verify when a scanner never returns', async () => {
    const boundedVerifier = new RescanVerifier(20);
    const result = await boundedVerifier.verifyPatch({
      finding: mockFinding,
      originalFileContent: 'vulnerable original',
      codeFix: 'patched content',
      filePath: 'db/users.ts',
      scanner: { name: 'MockScanner', scan: () => new Promise(() => {}) }
    });
    expect(result.status).toBe(FindingStatus.NOT_VERIFIED);
    expect(result.message).toContain('timed out');
  });
});
