"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateScore = calculateScore;
const types_1 = require("@maverick006/types");
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
function calculateScore(findings, coverage) {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;
    for (const finding of findings) {
        const sev = (finding.severity || '').toUpperCase();
        switch (sev) {
            case types_1.Severity.CRITICAL:
            case 'CRITICAL':
                critical++;
                break;
            case types_1.Severity.HIGH:
            case 'HIGH':
                high++;
                break;
            case types_1.Severity.MEDIUM:
            case 'MEDIUM':
                medium++;
                break;
            case types_1.Severity.LOW:
            case 'LOW':
                low++;
                break;
            default:
                info++;
                break;
        }
    }
    const critDeduction = critical * 30;
    const highDeduction = high * 10;
    const medDeduction = medium * 3;
    const lowDeduction = low * 1;
    const totalDeductions = critDeduction + highDeduction + medDeduction + lowDeduction;
    let rawScore = 100 - totalDeductions;
    let score = Math.max(0, Math.min(100, rawScore));
    const explanation = [
        'Baseline score: 100/100'
    ];
    if (critical > 0) {
        explanation.push(`-${critDeduction} points: ${critical} Critical severity ${critical === 1 ? 'finding' : 'findings'} (-30 pts each)`);
    }
    if (high > 0) {
        explanation.push(`-${highDeduction} points: ${high} High severity ${high === 1 ? 'finding' : 'findings'} (-10 pts each)`);
    }
    if (medium > 0) {
        explanation.push(`-${medDeduction} points: ${medium} Medium severity ${medium === 1 ? 'finding' : 'findings'} (-3 pts each)`);
    }
    if (low > 0) {
        explanation.push(`-${lowDeduction} points: ${low} Low severity ${low === 1 ? 'finding' : 'findings'} (-1 pt each)`);
    }
    if (findings.length === 0) {
        explanation.push('No security findings identified across executed scanners (+0 deductions)');
    }
    let grade = 'A';
    if (critical > 0) {
        // Critical vulnerability automatically caps grade to F and score to at most 49
        grade = 'F';
        score = Math.min(score, 49);
        explanation.push(`Grade Override: F (1 or more Critical severity findings detected)`);
    }
    else if (score >= 90) {
        grade = 'A';
    }
    else if (score >= 80) {
        grade = 'B';
    }
    else if (score >= 70) {
        grade = 'C';
    }
    else if (score >= 50) {
        grade = 'D';
    }
    else {
        grade = 'F';
    }
    explanation.push(`Final deterministic score: ${score}/100 (Grade ${grade})`);
    const deductions = {
        critical: critDeduction,
        high: highDeduction,
        medium: medDeduction,
        low: lowDeduction,
        info: 0,
        totalDeductions
    };
    const defaultCoverage = {
        code: false,
        dependencies: false,
        secrets: false,
        containers: false,
        iac: false,
        web: false,
        cloud: false,
        ...coverage
    };
    return {
        score,
        grade,
        deductions,
        breakdown: {
            critical,
            high,
            medium,
            low,
            info
        },
        metrics: {
            critical,
            high,
            medium,
            low
        },
        coverage: defaultCoverage,
        explanation
    };
}
//# sourceMappingURL=scoring.js.map