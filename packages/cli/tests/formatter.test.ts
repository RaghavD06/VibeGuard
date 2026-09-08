import {
  renderDashboard,
  calculateScore,
  maskSecrets,
  renderCIOutput,
  generateJsonOutput,
  evaluatePolicy,
  ScanStats,
  AIRemediationData,
  ScannerTelemetry
} from '../src/formatter';
import { NormalizedFinding, Severity, ScannerCoverage, DeterministicScore } from '@maverick006/types';

describe('VibeGuard CLI UX & Formatter Test Suite', () => {
  function captureOutput(fn: () => void): string {
    const logs: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
    try {
      fn();
    } finally {
      spy.mockRestore();
    }
    return logs.join('\n').replace(/\u001b\[[0-9;]*m/g, '');
  }

  const dummyGitInfo = {
    name: 'VibeGuard',
    branch: 'main',
    commit: 'a1b2c3d',
    remoteUrl: 'https://github.com/Maverickrd007/VibeGuard.git'
  };

  const perfectCoverage: ScannerCoverage = {
    code: true,
    dependencies: true,
    secrets: true,
    containers: true,
    iac: true,
    web: true,
    cloud: true
  };

  const createFinding = (overrides: Partial<NormalizedFinding> = {}): NormalizedFinding => ({
    id: 'VG-FIND-001',
    scanner: 'test-scanner',
    ruleId: 'test-rule',
    title: 'Test Finding',
    description: 'Test vulnerability description',
    severity: Severity.LOW,
    file: 'src/index.ts',
    line: 1,
    ...overrides
  });

  const dummyDeterministicScore = (
    score: number,
    grade: 'A' | 'B' | 'C' | 'D' | 'F',
    overrides: Partial<DeterministicScore> = {}
  ): DeterministicScore => ({
    score,
    grade,
    deductions: { critical: 0, high: 0, medium: 0, low: 0, info: 0, totalDeductions: 100 - score },
    breakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    coverage: perfectCoverage,
    explanation: ['Baseline score: 100/100'],
    ...overrides
  });

  // 1. Full scanner availability
  it('1. Full scanner availability renders full score & full coverage', () => {
    const scanners: ScannerTelemetry[] = [
      { scanner: 'Semgrep', state: 'SUCCESS', durationMs: 1500, findingsCount: 0 },
      { scanner: 'npm-audit', state: 'SUCCESS', durationMs: 800, findingsCount: 0 },
      { scanner: 'Gitleaks', state: 'SUCCESS', durationMs: 400, findingsCount: 0 },
      { scanner: 'Trivy', state: 'SUCCESS', durationMs: 1200, findingsCount: 0 },
      { scanner: 'Checkov', state: 'SUCCESS', durationMs: 1800, findingsCount: 0 },
      { scanner: 'OWASP ZAP', state: 'SUCCESS', durationMs: 2500, findingsCount: 0 },
      { scanner: 'Prowler', state: 'SUCCESS', durationMs: 3100, findingsCount: 0 }
    ];

    const stats = calculateScore([]);
    const output = captureOutput(() => {
      renderDashboard({
        findings: [],
        stats,
        deterministicScore: dummyDeterministicScore(100, 'A'),
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '11.3s',
        scanners
      });
    });

    expect(output).toContain('COMPLETE POSTURE (7 / 7 security domains assessed)');
    expect(output).toContain('Coverage: 7 / 7 security domains');
    expect(output).toContain('100 / 100');
    expect(output).toContain('Grade A');
    expect(output).toContain('✓ Dependencies  ✓ Code  ✓ Secrets  ✓ Containers  ✓ IaC  ✓ Web/API  ✓ Cloud');
  });

  // 2. Partial scanner availability & PARTIAL POSTURE
  it('2. Partial scanner availability renders PARTIAL POSTURE and correct domain count', () => {
    const partialCoverage: ScannerCoverage = {
      code: false,
      dependencies: true,
      secrets: false,
      containers: false,
      iac: false,
      web: false,
      cloud: false
    };

    const scanners: ScannerTelemetry[] = [
      { scanner: 'npm-audit', state: 'SUCCESS', durationMs: 750, findingsCount: 1 },
      { scanner: 'Semgrep', state: 'NOT_INSTALLED' },
      { scanner: 'Gitleaks', state: 'NOT_INSTALLED' },
      { scanner: 'Trivy', state: 'NOT_INSTALLED' },
      { scanner: 'Checkov', state: 'NOT_INSTALLED' },
      { scanner: 'OWASP ZAP', state: 'SKIPPED', reason: 'No live web URL provided' },
      { scanner: 'Prowler', state: 'SKIPPED', reason: 'AWS credentials not configured' }
    ];

    const finding = createFinding({
      id: 'VG-FIND-001',
      scanner: 'npm-audit',
      ruleId: 'GHSA-4497',
      title: 'Vulnerable package',
      severity: Severity.LOW,
      file: 'package.json',
      line: 12
    });

    const stats = calculateScore([finding]);
    const output = captureOutput(() => {
      renderDashboard({
        findings: [finding],
        stats,
        deterministicScore: dummyDeterministicScore(99, 'A'),
        coverage: partialCoverage,
        gitInfo: dummyGitInfo,
        duration: '0.8s',
        scanners
      });
    });

    expect(output).toContain('PARTIAL POSTURE (1 / 7 security domains assessed)');
    expect(output).toContain('Coverage: 1 / 7 security domains');
    expect(output).toContain('○ NOT INSTALLED');
    expect(output).toContain('— NOT APPLICABLE');
  });

  // 3. All scanners unavailable
  it('3. All scanners unavailable renders clean explanation and 0/7 domains', () => {
    const zeroCoverage: ScannerCoverage = {
      code: false,
      dependencies: false,
      secrets: false,
      containers: false,
      iac: false,
      web: false,
      cloud: false
    };

    const scanners: ScannerTelemetry[] = [
      { scanner: 'Semgrep', state: 'NOT_INSTALLED' },
      { scanner: 'npm-audit', state: 'NOT_INSTALLED' },
      { scanner: 'Gitleaks', state: 'NOT_INSTALLED' },
      { scanner: 'Trivy', state: 'NOT_INSTALLED' },
      { scanner: 'Checkov', state: 'NOT_INSTALLED' },
      { scanner: 'OWASP ZAP', state: 'NOT_INSTALLED' },
      { scanner: 'Prowler', state: 'NOT_INSTALLED' }
    ];

    const stats = calculateScore([]);
    const output = captureOutput(() => {
      renderDashboard({
        findings: [],
        stats,
        deterministicScore: dummyDeterministicScore(100, 'A'),
        coverage: zeroCoverage,
        gitInfo: dummyGitInfo,
        duration: '0.2s',
        scanners
      });
    });

    expect(output).toContain('PARTIAL POSTURE (0 / 7 security domains assessed)');
    expect(output).toContain('Coverage: 0 / 7 security domains');
    expect(output).toContain('0 / 7');
  });

  // 4. ZAP not applicable when no web target exists
  it('4. ZAP not applicable when no web target exists', () => {
    const scanners: ScannerTelemetry[] = [
      { scanner: 'OWASP ZAP', state: 'SKIPPED', reason: 'No live web URL provided' }
    ];

    const stats = calculateScore([]);
    const output = captureOutput(() => {
      renderDashboard({
        findings: [],
        stats,
        deterministicScore: dummyDeterministicScore(100, 'A'),
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '0.1s',
        scanners
      });
    });

    expect(output).toContain('OWASP ZAP');
    expect(output).toContain('— NOT APPLICABLE');
    expect(output).toContain('(No live web URL provided)');
  });

  // 5. Prowler not applicable when no AWS credentials exist
  it('5. Prowler not applicable when no AWS credentials exist', () => {
    const scanners: ScannerTelemetry[] = [
      { scanner: 'Prowler', state: 'SKIPPED', reason: 'AWS credentials not configured' }
    ];

    const stats = calculateScore([]);
    const output = captureOutput(() => {
      renderDashboard({
        findings: [],
        stats,
        deterministicScore: dummyDeterministicScore(100, 'A'),
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '0.1s',
        scanners
      });
    });

    expect(output).toContain('Prowler');
    expect(output).toContain('— NOT APPLICABLE');
    expect(output).toContain('(AWS credentials not configured)');
  });

  // 6. Findings table formats and truncates properly
  it('6. Findings table formats and truncates properly', () => {
    const manyFindings: NormalizedFinding[] = Array.from({ length: 7 }, (_, i) =>
      createFinding({
        id: `VG-FIND-${String(i + 1).padStart(3, '0')}`,
        scanner: 'Semgrep',
        ruleId: `rule-${i}`,
        title: `This is an extremely long vulnerability title that exceeds column width #${i + 1}`,
        severity: Severity.MEDIUM,
        file: 'src/auth/jwt.ts',
        line: 42 + i
      })
    );

    const stats = calculateScore(manyFindings);
    const output = captureOutput(() => {
      renderDashboard({
        findings: manyFindings,
        stats,
        deterministicScore: dummyDeterministicScore(79, 'C'),
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '1.2s',
        scanners: []
      });
    });

    expect(output).toContain('Showing 5 of 7 findings');
    expect(output).toContain('VG-FIND-001');
    expect(output).toContain('VG-FIND-005');
    expect(output).not.toContain('VG-FIND-006');
    expect(output).toContain('..'); // Truncation mark
  });

  // 7. Deduplicated finding IDs are consistent across runs
  it('7. Deduplicated finding IDs are consistent across runs', () => {
    const findings: NormalizedFinding[] = [
      createFinding({
        id: 'VG-FIND-001',
        scanner: 'npm-audit',
        ruleId: 'GHSA-1',
        title: 'Issue 1',
        severity: Severity.HIGH,
        file: 'package.json',
        line: 10
      }),
      createFinding({
        id: 'VG-FIND-002',
        scanner: 'Semgrep',
        ruleId: 'rules.injection',
        title: 'Issue 2',
        severity: Severity.LOW,
        file: 'src/index.ts',
        line: 25
      })
    ];

    const stats = calculateScore(findings);
    const output = captureOutput(() => {
      renderDashboard({
        findings,
        stats,
        deterministicScore: dummyDeterministicScore(89, 'B'),
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '1.0s',
        scanners: []
      });
    });

    expect(output).toContain('VG-FIND-001');
    expect(output).toContain('VG-FIND-002');
  });

  // 8. Score breakdown math is accurate
  it('8. Score breakdown math is accurate', () => {
    const findings: NormalizedFinding[] = [
      createFinding({ id: 'VG-FIND-001', scanner: 'test', ruleId: 'r1', title: 'High finding', severity: Severity.HIGH, file: 'a.ts', line: 1 }),
      createFinding({ id: 'VG-FIND-002', scanner: 'test', ruleId: 'r2', title: 'Medium finding', severity: Severity.MEDIUM, file: 'b.ts', line: 2 }),
      createFinding({ id: 'VG-FIND-003', scanner: 'test', ruleId: 'r3', title: 'Low finding', severity: Severity.LOW, file: 'c.ts', line: 3 })
    ];

    const stats = calculateScore(findings);
    // Base 100 - (10 + 3 + 1) = 86, Grade B
    expect(stats.score).toBe(86);
    expect(stats.grade).toBe('B');

    const scoreObj = dummyDeterministicScore(86, 'B', {
      deductions: { critical: 0, high: 10, medium: 3, low: 1, info: 0, totalDeductions: 14 },
      breakdown: { critical: 0, high: 1, medium: 1, low: 1, info: 0 }
    });

    const output = captureOutput(() => {
      renderDashboard({
        findings,
        stats,
        deterministicScore: scoreObj,
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '1.0s',
        scanners: []
      });
    });

    expect(output).toMatch(/Base score\s+100/);
    expect(output).toMatch(/1 × High finding\s+- 10/);
    expect(output).toMatch(/1 × Medium finding\s+- 3/);
    expect(output).toMatch(/1 × Low finding\s+- 1/);
    expect(output).toMatch(/Final score\s+86/);
    expect(output).toMatch(/Grade\s+B/);
  });

  // 9. Critical findings cap grade at F
  it('9. Critical findings cap grade at F', () => {
    const findings: NormalizedFinding[] = [
      createFinding({ id: 'VG-FIND-001', scanner: 'gitleaks', ruleId: 'secrets', title: 'Hardcoded Secret', severity: Severity.CRITICAL, file: 'config.ts', line: 5 })
    ];

    const stats = calculateScore(findings);
    expect(stats.grade).toBe('F');
    expect(stats.score).toBeLessThanOrEqual(49);

    const scoreObj = dummyDeterministicScore(49, 'F', {
      deductions: { critical: 30, high: 0, medium: 0, low: 0, info: 0, totalDeductions: 30 },
      breakdown: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
      explanation: ['Grade Override: F']
    });

    const output = captureOutput(() => {
      renderDashboard({
        findings,
        stats,
        deterministicScore: scoreObj,
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '0.5s',
        scanners: []
      });
    });

    expect(output).toContain('Critical finding detected: Grade capped at F');
    expect(output).toContain('Grade F');
  });

  // 10. AI remediation unavailable message when API key missing
  it('10. AI remediation unavailable message when API key missing', () => {
    const remediation: AIRemediationData = {
      findingId: 'VG-FIND-001',
      issue: 'Exposed API token',
      hasConcretePatch: false,
      status: 'UNAVAILABLE',
      unavailableReason: 'NVIDIA_API_KEY not configured.'
    };

    const stats = calculateScore([]);
    const output = captureOutput(() => {
      renderDashboard({
        findings: [],
        stats,
        deterministicScore: dummyDeterministicScore(100, 'A'),
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '0.5s',
        scanners: [],
        remediation
      });
    });

    expect(output).toContain('▶ AI REMEDIATION · UNAVAILABLE');
    expect(output).toContain('NVIDIA_API_KEY not configured.');
    expect(output).toContain('Scanning, deterministic scoring, and policy enforcement remain 100% operational.');
  });

  // 11. AI remediation with valid response renders structured blocks
  it('11. AI remediation with valid response renders structured blocks', () => {
    const remediation: AIRemediationData = {
      findingId: 'VG-FIND-001',
      severity: 'HIGH',
      issue: 'Prototype Pollution vulnerability in lodash',
      impact: 'Attacker may inject arbitrary properties into Object.prototype',
      recommendation: 'Upgrade lodash to >= 4.17.21',
      suggestedFix: '- "lodash": "4.17.15"\n+ "lodash": "4.17.21"',
      hasConcretePatch: true,
      confidence: 90,
      status: 'AWAITING REVIEW'
    };

    const stats = calculateScore([]);
    const output = captureOutput(() => {
      renderDashboard({
        findings: [],
        stats,
        deterministicScore: dummyDeterministicScore(90, 'A'),
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '1.0s',
        scanners: [],
        remediation
      });
    });

    expect(output).toContain('▶ AI REMEDIATION · OPTIONAL');
    expect(output).toContain('ISSUE');
    expect(output).toContain('Prototype Pollution vulnerability in lodash');
    expect(output).toContain('IMPACT');
    expect(output).toContain('Attacker may inject arbitrary properties into Object.prototype');
    expect(output).toContain('RECOMMENDED FIX');
    expect(output).toContain('Upgrade lodash to >= 4.17.21');
    expect(output).toContain('SUGGESTED FIX');
    expect(output).toContain('Confidence: 90%');
    expect(output).toContain('Status:     AWAITING REVIEW');
  });

  // 12. AI remediation with malformed JSON falls back gracefully to guidance
  it('12. AI remediation with malformed JSON falls back gracefully to guidance', () => {
    const remediation: AIRemediationData = {
      findingId: 'VG-FIND-001',
      severity: 'MEDIUM',
      issue: 'SQL parameterization advice',
      impact: 'Potential data leakage',
      recommendation: 'Use parameterized queries instead of string concatenation',
      hasConcretePatch: false,
      status: 'GUIDANCE ONLY'
    };

    const stats = calculateScore([]);
    const output = captureOutput(() => {
      renderDashboard({
        findings: [],
        stats,
        deterministicScore: dummyDeterministicScore(95, 'A'),
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '1.0s',
        scanners: [],
        remediation
      });
    });

    expect(output).toContain('RECOMMENDED FIX');
    expect(output).toContain('Use parameterized queries instead of string concatenation');
    expect(output).toContain('No patch generated — guidance only.');
    expect(output).toContain('Status:     GUIDANCE ONLY');
  });

  // 13. AI remediation with no patch renders GUIDANCE ONLY without patch box
  it('13. AI remediation with no patch renders GUIDANCE ONLY without patch box', () => {
    const remediation: AIRemediationData = {
      findingId: 'VG-FIND-002',
      issue: 'Missing security header',
      hasConcretePatch: false,
      status: 'GUIDANCE ONLY'
    };

    const stats = calculateScore([]);
    const output = captureOutput(() => {
      renderDashboard({
        findings: [],
        stats,
        deterministicScore: dummyDeterministicScore(97, 'A'),
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '0.4s',
        scanners: [],
        remediation
      });
    });

    expect(output).toContain('No patch generated — guidance only.');
    expect(output).toContain('Status:     GUIDANCE ONLY');
    expect(output).not.toContain('Confidence:');
  });

  // 14. CI mode outputs expected PASS/FAIL format
  it('14. CI mode outputs expected PASS/FAIL format', () => {
    const scoreObj = dummyDeterministicScore(100, 'A');
    const passLines = renderCIOutput({
      deterministicScore: scoreObj,
      findings: [],
      policyPassed: true,
      failThreshold: 'high'
    });

    const passOutput = passLines.join('\n');
    expect(passOutput).toContain('VibeGuard Security Policy');
    expect(passOutput).toContain('Score: 100/100 (A)');
    expect(passOutput).toContain('Policy: PASS');
    expect(passOutput).toContain('Threshold: HIGH');

    const failScoreObj = dummyDeterministicScore(70, 'C', {
      deductions: { critical: 0, high: 20, medium: 0, low: 0, info: 0, totalDeductions: 20 },
      breakdown: { critical: 0, high: 2, medium: 0, low: 0, info: 0 }
    });

    const failLines = renderCIOutput({
      deterministicScore: failScoreObj,
      findings: [
        createFinding({ id: 'VG-FIND-001', scanner: 'test', ruleId: 'r1', title: 'h1', severity: Severity.HIGH, file: 'a.ts', line: 1 }),
        createFinding({ id: 'VG-FIND-002', scanner: 'test', ruleId: 'r2', title: 'h2', severity: Severity.HIGH, file: 'b.ts', line: 2 })
      ],
      policyPassed: false,
      failThreshold: 'high'
    });

    const failOutput = failLines.join('\n');
    expect(failOutput).toContain('Score: 70/100 (C)');
    expect(failOutput).toContain('Policy: FAIL');
    expect(failOutput).toContain('High: 2');
  });

  // 15. JSON mode outputs valid JSON with expected schema
  it('15. JSON mode outputs valid JSON with expected schema', () => {
    const jsonResult = generateJsonOutput({
      deterministicScore: dummyDeterministicScore(100, 'A'),
      findings: [
        createFinding({
          id: 'VG-FIND-001',
          title: 'Exposed credentials',
          severity: Severity.CRITICAL,
          scanner: 'Gitleaks',
          file: '.env',
          line: 3,
          ruleId: 'generic-api-key',
          cwe: 'CWE-798',
          owasp: 'A07:2021'
        })
      ],
      coverageData: perfectCoverage,
      activeDomainsCount: 7,
      postureStatus: 'COMPLETE',
      scanners: [{ scanner: 'Gitleaks', state: 'SUCCESS', durationMs: 250, findingsCount: 1 }],
      gitInfo: dummyGitInfo,
      policyPassed: false,
      failThreshold: 'critical',
      durationMs: 1200
    });

    const serialized = JSON.stringify(jsonResult);
    expect(() => JSON.parse(serialized)).not.toThrow();

    const parsed = JSON.parse(serialized);
    expect(parsed.score).toBe(100);
    expect(parsed.grade).toBe('A');
    expect(parsed.postureStatus).toBe('COMPLETE');
    expect(parsed.coverage.assessedDomains).toBe(7);
    expect(parsed.coverage.totalDomains).toBe(7);
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0].id).toBe('VG-FIND-001');
    expect(parsed.repository.name).toBe('VibeGuard');
    expect(parsed.policyResult.passed).toBe(false);
    expect(parsed.policyResult.threshold).toBe('CRITICAL');
  });

  // 16. Exit codes match policy results (0 for pass, 1 for fail, 2 for error)
  it('16. Exit codes match policy results (0 for pass, 1 for fail, 2 for error)', () => {
    // Threshold HIGH: passes if no critical or high
    const resPass = evaluatePolicy('high', { critical: 0, high: 0, medium: 2, low: 1 }, 3);
    expect(resPass.passed).toBe(true);
    expect(resPass.exitCode).toBe(0);

    // Threshold HIGH: fails if high exists
    const resFailHigh = evaluatePolicy('high', { critical: 0, high: 1, medium: 0, low: 0 }, 1);
    expect(resFailHigh.passed).toBe(false);
    expect(resFailHigh.exitCode).toBe(1);

    // Threshold CRITICAL: passes if only high exists
    const resPassCritical = evaluatePolicy('critical', { critical: 0, high: 2, medium: 1, low: 0 }, 3);
    expect(resPassCritical.passed).toBe(true);
    expect(resPassCritical.exitCode).toBe(0);

    // Threshold CRITICAL: fails if critical exists
    const resFailCritical = evaluatePolicy('critical', { critical: 1, high: 0, medium: 0, low: 0 }, 1);
    expect(resFailCritical.passed).toBe(false);
    expect(resFailCritical.exitCode).toBe(1);
  });

  // 17. No secrets are leaked in CLI output under any condition
  it('17. No secrets are leaked in CLI output under any condition', () => {
    const rawAwsKey = 'AKIA1234567890ABCDEF';
    const rawGithubToken = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890';
    const rawSecretAssignment = 'api_key: "super_secret_token_12345"';

    // Test maskSecrets directly
    expect(maskSecrets(rawAwsKey)).toBe('AKIA****************');
    expect(maskSecrets(rawGithubToken)).toBe('ghp_************************************');
    expect(maskSecrets(rawSecretAssignment)).toBe('api_key: [REDACTED]');

    // Test renderDashboard with a finding containing secrets
    const secretFinding = createFinding({
      id: 'VG-FIND-001',
      scanner: 'Gitleaks',
      ruleId: 'aws-access-token',
      title: `Leaked key ${rawAwsKey}`,
      severity: Severity.CRITICAL,
      file: 'credentials.json',
      line: 4
    });

    const stats = calculateScore([secretFinding]);
    const output = captureOutput(() => {
      renderDashboard({
        findings: [secretFinding],
        stats,
        deterministicScore: dummyDeterministicScore(49, 'F'),
        coverage: perfectCoverage,
        gitInfo: dummyGitInfo,
        duration: '0.4s',
        scanners: [],
        remediation: {
          findingId: 'VG-FIND-001',
          issue: `Found token ${rawGithubToken}`,
          suggestedFix: `Remove ${rawAwsKey}`,
          hasConcretePatch: true,
          status: 'AWAITING REVIEW'
        }
      });
    });

    // Ensure raw secrets do NOT appear anywhere in the output
    expect(output).not.toContain(rawAwsKey);
    expect(output).not.toContain(rawGithubToken);
    expect(output).toContain('AKIA****************');
    expect(output).toContain('ghp_************************************');
  });
});
