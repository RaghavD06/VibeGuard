import { calculateScore } from '../src/scoring';
import { NormalizedFinding, Severity } from '@maverick006/types';

describe('Deterministic Scoring Engine (0-100)', () => {
  const createFinding = (severity: Severity, title = 'test finding'): NormalizedFinding => ({
    scanner: 'test',
    ruleId: 'test-rule',
    title,
    description: 'test desc',
    severity,
    file: 'test.ts',
    line: 1
  });

  it('should return score 100 and grade A for perfect score (0 findings)', () => {
    const result = calculateScore([]);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.deductions.totalDeductions).toBe(0);
    expect(result.explanation).toContain('Baseline score: 100/100');
    expect(result.explanation.some(e => e.includes('No security findings identified'))).toBe(true);
  });

  it('should deduct 3 points per medium finding (e.g. 2 mediums = 94, Grade A)', () => {
    const findings = [
      createFinding(Severity.MEDIUM), // -3
      createFinding(Severity.MEDIUM), // -3
    ];
    const result = calculateScore(findings);
    expect(result.score).toBe(94);
    expect(result.grade).toBe('A');
    expect(result.deductions.medium).toBe(6);
    expect(result.breakdown.medium).toBe(2);
  });

  it('should deduct 10 for high and 1 for low (e.g. 1 high, 2 lows = 88, Grade B)', () => {
    const findings = [
      createFinding(Severity.HIGH), // -10
      createFinding(Severity.LOW),  // -1
      createFinding(Severity.LOW),  // -1
    ];
    const result = calculateScore(findings);
    expect(result.score).toBe(88);
    expect(result.grade).toBe('B');
    expect(result.deductions.high).toBe(10);
    expect(result.deductions.low).toBe(2);
    expect(result.deductions.totalDeductions).toBe(12);
  });

  it('should immediately force grade F and cap score to <= 49 if any CRITICAL exists', () => {
    const findings = [
      createFinding(Severity.CRITICAL), // -30, and caps grade to F, score to <= 49
      createFinding(Severity.LOW),      // -1
    ];
    const result = calculateScore(findings);
    expect(result.score).toBeLessThanOrEqual(49);
    expect(result.grade).toBe('F');
    expect(result.deductions.critical).toBe(30);
    expect(result.breakdown.critical).toBe(1);
    expect(result.explanation.some(e => e.includes('Grade Override: F'))).toBe(true);
  });

  it('should clamp minimum score at 0 and return grade F for heavy deductions', () => {
    const findings = Array(15).fill(createFinding(Severity.HIGH)); // 15 * 10 = -150
    const result = calculateScore(findings);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
    expect(result.deductions.totalDeductions).toBe(150);
  });
});
