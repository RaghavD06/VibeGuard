import { NormalizedFinding, Severity, Confidence } from '@maverick006/types';

export function parseTrivyOutput(scanId: string, output: string): NormalizedFinding[] {
  try {
    const data = JSON.parse(output);
    const findings: NormalizedFinding[] = [];

    if (data.SchemaVersion !== 2 || (data.Results !== undefined && !Array.isArray(data.Results))) throw new Error('Invalid Trivy report');

    for (const result of data.Results || []) {
      const target = result.Target;
      
      // Handle Vulnerabilities (OS packages, language dependencies)
      if (Array.isArray(result.Vulnerabilities)) {
        for (const vuln of result.Vulnerabilities) {
          
          let severity = Severity.INFO;
          if (vuln.Severity === 'CRITICAL') severity = Severity.CRITICAL;
          else if (vuln.Severity === 'HIGH') severity = Severity.HIGH;
          else if (vuln.Severity === 'MEDIUM') severity = Severity.MEDIUM;
          else if (vuln.Severity === 'LOW') severity = Severity.LOW;

          const finding: NormalizedFinding = {
            scanId,
            scanner: 'Trivy',
            scannerVersion: 'unknown',
            ruleId: vuln.VulnerabilityID || 'trivy-vuln',
            title: vuln.Title || `${vuln.PkgName} vulnerability`,
            description: `${vuln.Description || ''} Target: ${target}. Installed: ${vuln.InstalledVersion}. Fixed: ${vuln.FixedVersion || 'None'}.`,
            severity,
            confidence: Confidence.HIGH, 
            category: 'container',
            file: target,
            line: 1, 
            cwe: Array.isArray(vuln.CweIDs) ? vuln.CweIDs.join(', ') : vuln.CweIDs,
            owasp: 'A06:2021', // Vulnerable and Outdated Components
          };
          findings.push(finding);
        }
      }

      // Handle Misconfigurations (Dockerfile, IaC)
      if (Array.isArray(result.Misconfigurations)) {
        for (const misconf of result.Misconfigurations) {
          if (misconf.Status !== 'FAIL') continue;

          let severity = Severity.INFO;
          if (misconf.Severity === 'CRITICAL') severity = Severity.CRITICAL;
          else if (misconf.Severity === 'HIGH') severity = Severity.HIGH;
          else if (misconf.Severity === 'MEDIUM') severity = Severity.MEDIUM;
          else if (misconf.Severity === 'LOW') severity = Severity.LOW;

          const finding: NormalizedFinding = {
            scanId,
            scanner: 'Trivy',
            scannerVersion: 'unknown',
            ruleId: misconf.ID || 'trivy-misconf',
            title: misconf.Title || misconf.Type,
            description: `${misconf.Description || ''} Message: ${misconf.Message}. Resolution: ${misconf.Resolution}.`,
            severity,
            confidence: Confidence.HIGH, 
            category: 'iac',
            file: target,
            line: misconf.CauseMetadata?.StartLine || 1,
            cwe: 'CWE-16', // Configuration
            owasp: 'A05:2021', // Security Misconfiguration
          };
          findings.push(finding);
        }
      }
    }

    return findings;
  } catch (error) {
    throw new Error('Failed to parse Trivy JSON output');
  }
}
