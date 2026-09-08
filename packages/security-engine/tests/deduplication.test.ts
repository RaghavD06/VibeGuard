import { deduplicateFindings } from '../src/deduplication';
import { NormalizedFinding, Severity } from '@maverick006/types';

describe('Cross-Scanner Deduplication Engine', () => {
  it('should remove exact duplicate findings from the same scanner', () => {
    const findings: NormalizedFinding[] = [
      {
        scanner: 'Semgrep',
        ruleId: 'sql-injection',
        title: 'SQL Injection in Query',
        description: 'User input concatenation',
        severity: Severity.CRITICAL,
        file: 'src/db.ts',
        line: 42,
        column: 10
      },
      {
        scanner: 'Semgrep',
        ruleId: 'sql-injection',
        title: 'SQL Injection in Query',
        description: 'User input concatenation',
        severity: Severity.CRITICAL,
        file: 'src/db.ts',
        line: 42,
        column: 10
      }
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(1);
    expect(result[0].scanner).toBe('Semgrep');
  });

  it('should deduplicate cross-scanner findings with same CVE on same file/package', () => {
    const findings: NormalizedFinding[] = [
      {
        scanner: 'npm-audit',
        ruleId: 'CVE-2023-45133',
        title: 'CVE-2023-45133 in @babel/traverse',
        description: 'Arbitrary code execution via traverse',
        severity: Severity.HIGH,
        package: '@babel/traverse',
        packageVersion: '7.23.0',
        fixedVersion: '7.23.2',
        file: 'package-lock.json'
      },
      {
        scanner: 'Trivy',
        ruleId: 'CVE-2023-45133',
        title: 'Babel traverse code execution (CVE-2023-45133)',
        description: 'Arbitrary code execution in babel/traverse',
        severity: Severity.HIGH,
        package: '@babel/traverse',
        packageVersion: '7.23.0',
        fixedVersion: '7.23.2',
        file: 'package-lock.json'
      }
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(1);
    expect(result[0].scanner).toContain('npm-audit');
    expect(result[0].scanner).toContain('Trivy');
    expect(result[0].package).toBe('@babel/traverse');
  });

  it('should deduplicate findings with nearby line shifts (+/- 3 lines)', () => {
    const findings: NormalizedFinding[] = [
      {
        scanner: 'Semgrep',
        ruleId: 'hardcoded-secret',
        title: 'Hardcoded API Token',
        description: 'Detected high entropy string',
        severity: Severity.HIGH,
        file: 'src/config.ts',
        line: 15
      },
      {
        scanner: 'Gitleaks',
        ruleId: 'hardcoded-secret',
        title: 'Generic API Key',
        description: 'Detected secret key',
        severity: Severity.HIGH,
        file: 'src/config.ts',
        line: 17 // within 2 lines
      }
    ];

    const result = deduplicateFindings(findings, { lineTolerance: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].scanner).toContain('Semgrep');
    expect(result[0].scanner).toContain('Gitleaks');
  });

  it('should preserve distinct vulnerabilities on the same file and line', () => {
    const findings: NormalizedFinding[] = [
      {
        scanner: 'Semgrep',
        ruleId: 'sqli-rule-1',
        title: 'SQL Injection',
        description: 'Unescaped SQL query',
        severity: Severity.CRITICAL,
        file: 'src/api/user.ts',
        line: 25
      },
      {
        scanner: 'Semgrep',
        ruleId: 'xss-rule-2',
        title: 'Cross-Site Scripting (XSS)',
        description: 'Unsanitized HTML rendering',
        severity: Severity.HIGH,
        file: 'src/api/user.ts',
        line: 25
      }
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.title)).toContain('SQL Injection');
    expect(result.map(r => r.title)).toContain('Cross-Site Scripting (XSS)');
  });
});
