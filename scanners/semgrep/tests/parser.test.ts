import { parseSemgrepOutput } from '../src/parser';
import * as fs from 'fs';
import * as path from 'path';
import { Severity, Confidence } from '@maverick006/types';

describe('Semgrep Parser', () => {
  it('should parse semgrep json output correctly', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'semgrep-output.json');
    const output = fs.readFileSync(fixturePath, 'utf8');
    
    const findings = parseSemgrepOutput('test-scan-123', output);
    
    expect(findings.length).toBe(2);
    
    // Check first finding (SQL Injection)
    const sqlInjection = findings[0];
    expect(sqlInjection.scanId).toBe('test-scan-123');
    expect(sqlInjection.scanner).toBe('Semgrep');
    expect(sqlInjection.scannerVersion).toBe('1.30.0');
    expect(sqlInjection.ruleId).toBe('javascript.express.security.injection.tainted-sql-string.tainted-sql-string');
    expect(sqlInjection.severity).toBe(Severity.HIGH);
    expect(sqlInjection.confidence).toBe(Confidence.HIGH);
    expect(sqlInjection.cwe).toContain('CWE-89');
    expect(sqlInjection.owasp).toContain('A03:2021');
    expect(sqlInjection.file).toBe('src/index.js');
    expect(sqlInjection.line).toBe(15);
    
    // Check second finding (XSS)
    const xss = findings[1];
    expect(xss.severity).toBe(Severity.MEDIUM);
    expect(xss.confidence).toBe(Confidence.MEDIUM);
    expect(xss.cwe).toContain('CWE-79');
  });

  it('should handle empty or malformed output gracefully', () => {
    expect(() => parseSemgrepOutput('123', '{ invalid json }')).toThrow();
    expect(() => parseSemgrepOutput('123', '{}')).toThrow();
    expect(() => parseSemgrepOutput('123', '{"results":[],"errors":[{"level":"error"}]}')).toThrow();
    
    const emptyFindings = parseSemgrepOutput('123', '{"results": []}');
    expect(emptyFindings.length).toBe(0);
  });
});
