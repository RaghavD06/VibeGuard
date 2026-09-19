import { parseTrivyOutput } from '../src/parser';
import * as fs from 'fs';
import * as path from 'path';
import { Severity, Confidence } from '@maverick006/types';

describe('Trivy Parser', () => {
  it('should parse trivy json output correctly', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'trivy-output.json');
    const output = fs.readFileSync(fixturePath, 'utf8');
    
    const findings = parseTrivyOutput('test-scan-123', output);
    
    expect(findings.length).toBe(2);
    
    // Check first finding (OS Vulnerability)
    const osVuln = findings[0];
    expect(osVuln.scanId).toBe('test-scan-123');
    expect(osVuln.scanner).toBe('Trivy');
    expect(osVuln.title).toBe('busybox: double-free in the grep applet');
    expect(osVuln.severity).toBe(Severity.CRITICAL);
    expect(osVuln.confidence).toBe(Confidence.HIGH);
    expect(osVuln.cwe).toContain('CWE-415');
    expect(osVuln.file).toContain('alpine');
    expect(osVuln.category).toBe('container');
    expect(osVuln.description).toContain('Fixed: 1.34.1-r5');
    
    // Check second finding (Dockerfile Misconfiguration)
    const misconf = findings[1];
    expect(misconf.title).toBe('Image user should not be \'root\'');
    expect(misconf.severity).toBe(Severity.HIGH);
    expect(misconf.category).toBe('iac');
    expect(misconf.file).toBe('Dockerfile');
    expect(misconf.line).toBe(1);
    expect(misconf.description).toContain('Resolution: Add \'USER');
  });

  it('should handle malformed output gracefully', () => {
    expect(() => parseTrivyOutput('123', '{ invalid json }')).toThrow();
    expect(() => parseTrivyOutput('123', '{}')).toThrow();
    
    const emptyFindings = parseTrivyOutput('123', '{"SchemaVersion": 2, "Results": []}');
    expect(emptyFindings.length).toBe(0);
  });
});
