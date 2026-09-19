import { parseGitleaksOutput } from '../src/parser';
import * as fs from 'fs';
import * as path from 'path';
import { Severity, Confidence } from '@maverick006/types';

describe('Gitleaks Parser', () => {
  it('should parse gitleaks json output correctly', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'gitleaks-output.json');
    const output = fs.readFileSync(fixturePath, 'utf8');
    
    const findings = parseGitleaksOutput('test-scan-123', output);
    
    expect(findings.length).toBe(2);
    
    // Check first finding (Generic API Key)
    const apiKey = findings[0];
    expect(apiKey.scanId).toBe('test-scan-123');
    expect(apiKey.scanner).toBe('Gitleaks');
    expect(apiKey.ruleId).toBe('generic-api-key');
    expect(apiKey.severity).toBe(Severity.CRITICAL);
    expect(apiKey.confidence).toBe(Confidence.HIGH);
    expect(apiKey.cwe).toContain('CWE-798');
    expect(apiKey.file).toBe('src/config/keys.js');
    expect(apiKey.line).toBe(12);
    expect(apiKey.category).toBe('secret');
    expect(apiKey.description).not.toContain('a1b2c3d4e5f6g7h8i9j0');
    expect(apiKey.codeSnippet).toBeUndefined();
    
    // Check second finding (AWS Key)
    const awsKey = findings[1];
    expect(awsKey.ruleId).toBe('aws-access-token');
    expect(awsKey.severity).toBe(Severity.CRITICAL);
  });

  it('should handle empty or malformed output gracefully', () => {
    expect(() => parseGitleaksOutput('123', '{ invalid json }')).toThrow();
    
    const emptyFindings = parseGitleaksOutput('123', '[]');
    expect(emptyFindings.length).toBe(0);

    const emptyString = parseGitleaksOutput('123', '   ');
    expect(emptyString.length).toBe(0);
  });
});
