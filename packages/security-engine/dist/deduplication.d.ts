import { NormalizedFinding } from '@maverick006/types';
/**
 * Options for finding deduplication.
 */
export interface DeduplicationOptions {
    lineTolerance?: number;
}
/**
 * Deduplicates findings across multiple scanners:
 * 1. Exact duplicates (same scanner, file, rule, line).
 * 2. Cross-scanner duplicates (e.g. Trivy & npm-audit reporting the same CVE or package vuln).
 * 3. Line shift tolerance (+/- 3 lines) to handle minor offset differences.
 * 4. Preserves distinct vulnerabilities on the same file/line.
 */
export declare function deduplicateFindings(findings: NormalizedFinding[], options?: DeduplicationOptions): NormalizedFinding[];
//# sourceMappingURL=deduplication.d.ts.map