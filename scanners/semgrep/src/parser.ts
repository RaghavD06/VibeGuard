import { NormalizedFinding, Severity, Confidence } from '@maverick006/types';

export function parseSemgrepOutput(scanId: string, output: string): NormalizedFinding[] {
  try {
    const data = JSON.parse(output);
    const findings: NormalizedFinding[] = [];

    if (!data.results || !Array.isArray(data.results)) {
      throw new Error('Semgrep did not return a results array');
    }
    if (Array.isArray(data.errors) && data.errors.some((error: any) => error.level === 'error')) throw new Error('Semgrep reported a scan error');

    const scannerVersion = data.version || 'unknown';

    for (const result of data.results) {
      const extra = result.extra || {};
      const metadata = extra.metadata || {};

      let severity = Severity.INFO;
      if (extra.severity === 'ERROR') {
        severity = Severity.HIGH; // Semgrep ERROR is usually High/Critical
      } else if (extra.severity === 'WARNING') {
        severity = Severity.MEDIUM;
      } else if (extra.severity === 'INFO') {
        severity = Severity.LOW;
      }

      let confidence = Confidence.MEDIUM;
      if (metadata.confidence) {
        const confStr = metadata.confidence.toUpperCase();
        if (confStr === 'HIGH') confidence = Confidence.HIGH;
        else if (confStr === 'LOW') confidence = Confidence.LOW;
      }

      const finding: NormalizedFinding = {
        scanId,
        scanner: 'Semgrep',
        scannerVersion,
        ruleId: result.check_id,
        title: result.check_id, // Semgrep rule IDs are often descriptive enough for titles
        description: extra.message || 'No description provided.',
        severity,
        confidence,
        category: metadata.category,
        owasp: Array.isArray(metadata.owasp) ? metadata.owasp.join(', ') : metadata.owasp,
        cwe: Array.isArray(metadata.cwe) ? metadata.cwe.join(', ') : metadata.cwe,
        file: result.path,
        line: result.start?.line,
        column: result.start?.col,
        codeSnippet: extra.lines,
      };

      findings.push(finding);
    }

    return findings;
  } catch (error) {
    throw new Error('Failed to parse Semgrep JSON output');
  }
}
