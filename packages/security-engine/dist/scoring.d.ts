import { NormalizedFinding, ScannerCoverage, DeterministicScore } from '@maverick006/types';
export interface ScoreResult extends DeterministicScore {
    metrics: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}
/**
 * Calculates a deterministic, reproducible security score (0 to 100) and grade
 * based on the volume and severity of unique findings.
 *
 * Rules:
 * - Base score: 100
 * - Critical: -30 points per finding (any critical forces Grade F and caps score at <= 49)
 * - High: -10 points per finding
 * - Medium: -3 points per finding
 * - Low: -1 point per finding
 * - Info: 0 points
 *
 * Grades:
 * A: 90 - 100
 * B: 80 - 89
 * C: 70 - 79
 * D: 50 - 69
 * F: < 50 OR any CRITICAL finding
 */
export declare function calculateScore(findings: NormalizedFinding[], coverage?: Partial<ScannerCoverage>): ScoreResult;
//# sourceMappingURL=scoring.d.ts.map