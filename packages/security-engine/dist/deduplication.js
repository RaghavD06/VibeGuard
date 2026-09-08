"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deduplicateFindings = deduplicateFindings;
/**
 * Normalizes a rule or CVE identifier to detect cross-scanner duplicates.
 */
function normalizeIdentifier(finding) {
    // If CVE or CWE is present, prioritize that as universal identifier
    const cveMatch = (finding.ruleId || finding.title || finding.description || '').match(/CVE-\d{4}-\d+/i);
    if (cveMatch) {
        return cveMatch[0].toUpperCase();
    }
    // If package-based vulnerability, match package + cwe/rule
    if (finding.package) {
        const pkg = finding.package.toLowerCase();
        const cwe = finding.cwe ? finding.cwe.toLowerCase() : '';
        return `pkg:${pkg}:${cwe || finding.ruleId || 'vuln'}`;
    }
    // Generic rule ID fallback
    return (finding.ruleId || finding.title || 'unknown').toLowerCase().trim();
}
/**
 * Normalizes file paths for reliable cross-platform comparison.
 */
function normalizeFilePath(filePath) {
    if (!filePath)
        return '';
    return filePath.replace(/\\/g, '/').toLowerCase().trim();
}
/**
 * Merges two findings for the same vulnerability, retaining the highest confidence and most complete metadata.
 */
function mergeFindings(primary, secondary) {
    return {
        ...primary,
        // Keep the more severe or primary severity
        severity: primary.severity || secondary.severity,
        confidence: primary.confidence || secondary.confidence,
        cwe: primary.cwe || secondary.cwe,
        owasp: primary.owasp || secondary.owasp,
        remediation: primary.remediation || secondary.remediation,
        codeSnippet: primary.codeSnippet || secondary.codeSnippet,
        package: primary.package || secondary.package,
        packageVersion: primary.packageVersion || secondary.packageVersion,
        fixedVersion: primary.fixedVersion || secondary.fixedVersion,
        references: Array.from(new Set([...(primary.references || []), ...(secondary.references || [])])),
        // Note in scanner if multiple scanners detected it
        scanner: primary.scanner.includes(secondary.scanner)
            ? primary.scanner
            : `${primary.scanner}, ${secondary.scanner}`
    };
}
/**
 * Deduplicates findings across multiple scanners:
 * 1. Exact duplicates (same scanner, file, rule, line).
 * 2. Cross-scanner duplicates (e.g. Trivy & npm-audit reporting the same CVE or package vuln).
 * 3. Line shift tolerance (+/- 3 lines) to handle minor offset differences.
 * 4. Preserves distinct vulnerabilities on the same file/line.
 */
function deduplicateFindings(findings, options = {}) {
    const lineTolerance = options.lineTolerance ?? 3;
    const deduplicated = [];
    for (const candidate of findings) {
        const candidateFile = normalizeFilePath(candidate.file);
        const candidateId = normalizeIdentifier(candidate);
        const candidateLine = candidate.line || 0;
        let matchedIndex = -1;
        for (let i = 0; i < deduplicated.length; i++) {
            const existing = deduplicated[i];
            const existingFile = normalizeFilePath(existing.file);
            const existingId = normalizeIdentifier(existing);
            const existingLine = existing.line || 0;
            // Check for same file & same vulnerability identity
            const isSameFile = candidateFile && existingFile ? candidateFile === existingFile : true;
            const isSameVuln = candidateId === existingId;
            if (isSameFile && isSameVuln) {
                // If line numbers exist, check line tolerance
                if (candidateLine > 0 && existingLine > 0) {
                    if (Math.abs(candidateLine - existingLine) <= lineTolerance) {
                        matchedIndex = i;
                        break;
                    }
                }
                else {
                    // If either lacks line numbers (e.g. package/repo level), treat as match
                    matchedIndex = i;
                    break;
                }
            }
        }
        if (matchedIndex >= 0) {
            // Merge with existing finding
            deduplicated[matchedIndex] = mergeFindings(deduplicated[matchedIndex], candidate);
        }
        else {
            deduplicated.push({ ...candidate });
        }
    }
    return deduplicated;
}
//# sourceMappingURL=deduplication.js.map