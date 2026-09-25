import chalk from 'chalk';
import { execSync } from 'child_process';
import { NormalizedFinding, Severity, ScannerCoverage, ScannerState, DeterministicScore } from '@maverick006/types';
import path from 'path';
import { renderPolishedDashboard } from './dashboard';

export interface ScanStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  riskLevel: 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK' | 'CRITICAL RISK';
}

export interface AIRemediationData {
  findingId: string;
  severity?: string;
  issue: string;
  impact?: string;
  recommendation?: string;
  suggestedFix?: string;
  hasConcretePatch: boolean;
  confidence?: number;
  status: 'AWAITING REVIEW' | 'GUIDANCE ONLY' | 'VERIFIED' | 'NOT_VERIFIED' | 'UNAVAILABLE';
  unavailableReason?: string;
}

export interface ScannerTelemetry {
  scanner: string;
  state: ScannerState | string;
  durationMs?: number;
  findingsCount?: number;
  reason?: string;
}

export interface RenderOptions {
  findings: NormalizedFinding[];
  stats: ScanStats;
  deterministicScore?: DeterministicScore;
  coverage: ScannerCoverage;
  gitInfo: ReturnType<typeof getGitInfo>;
  duration: string;
  scanners: ScannerTelemetry[];
  remediation?: AIRemediationData;
  syncStatus?: 'SYNCED' | 'SKIPPED' | 'FAILED';
  syncError?: string;
  policyThreshold?: string;
  verbose?: boolean;
  scanPath?: string;
}

export function maskSecrets(input: string): string {
  if (!input) return input;
  let masked = input;
  masked = masked.replace(/\b(AKIA[0-9A-Z]{16})\b/g, 'AKIA****************');
  masked = masked.replace(/\b(gh[pousr]_[A-Za-z0-9_]{36,255})\b/g, 'ghp_************************************');
  masked = masked.replace(/(bearer\s+)([a-zA-Z0-9_\-\.]{15,})/gi, '$1[REDACTED]');
  masked = masked.replace(/(password|secret|api[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9_\-\.]{8,})['"]?/gi, '$1: [REDACTED]');
  masked = masked.replace(/-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9_-]+PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]');
  return masked;
}

function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

function visibleWidth(str: string): number {
  const plain = stripAnsi(str);
  let width = 0;
  for (const char of plain) {
    const code = char.codePointAt(0) || 0;
    if (code === 0xFE0F || code === 0xFE0E) continue;
    if (code > 0x1F000 || (code >= 0x2600 && code <= 0x27BF)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function padVisible(str: string, targetWidth: number): string {
  const current = visibleWidth(str);
  const diff = Math.max(0, targetWidth - current);
  return str + ' '.repeat(diff);
}

export function getGitInfo(cwd: string = process.cwd()) {
  const resolvedCwd = path.resolve(cwd);
  let name = path.basename(resolvedCwd);
  let branch = 'main';
  let commit = 'HEAD';
  let remoteUrl = '';

  try {
    const branchOut = execSync('git rev-parse --abbrev-ref HEAD', { cwd, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    if (branchOut) branch = branchOut;
  } catch {}

  try {
    const commitOut = execSync('git rev-parse --short HEAD', { cwd, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    if (commitOut) commit = commitOut;
  } catch {}

  try {
    const gitRemote = execSync('git config --get remote.origin.url', { cwd, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    if (gitRemote) {
      remoteUrl = gitRemote;
      const match = gitRemote.match(/\/([^/]+?)(\.git)?$/);
      if (match && match[1]) name = match[1];
    }
  } catch {}

  return { name, branch, commit, remoteUrl };
}

export function calculateScore(findings: NormalizedFinding[]): ScanStats {
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  let info = 0;

  for (const f of findings) {
    const sev = (f.severity || '').toUpperCase();
    if (sev === 'CRITICAL' || sev === Severity.CRITICAL) critical++;
    else if (sev === 'HIGH' || sev === Severity.HIGH) high++;
    else if (sev === 'MEDIUM' || sev === Severity.MEDIUM) medium++;
    else if (sev === 'LOW' || sev === Severity.LOW) low++;
    else info++;
  }

  const deductions = (critical * 30) + (high * 10) + (medium * 3) + (low * 1);
  let score = Math.max(0, Math.min(100, 100 - deductions));

  let grade: ScanStats['grade'] = 'A';
  if (critical > 0) {
    grade = 'F';
    score = Math.min(score, 49);
  } else if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 50) grade = 'D';
  else grade = 'F';

  let riskLevel: ScanStats['riskLevel'] = 'LOW RISK';
  if (grade === 'F') riskLevel = 'CRITICAL RISK';
  else if (grade === 'D') riskLevel = 'HIGH RISK';
  else if (grade === 'C' || grade === 'B') riskLevel = 'MEDIUM RISK';

  return {
    critical,
    high,
    medium,
    low,
    info,
    total: findings.length,
    score,
    grade,
    riskLevel
  };
}

export function renderDashboard(options: RenderOptions) {
  renderPolishedDashboard(options, maskSecrets);
}

export function renderCIOutput(options: {
  deterministicScore: DeterministicScore;
  findings: NormalizedFinding[];
  policyPassed: boolean;
  syncStatus?: 'SYNCED' | 'SKIPPED' | 'FAILED';
  syncError?: string;
  failThreshold: string;
  scanners?: ScannerTelemetry[];
  verbose?: boolean;
  exitCode?: number;
}): string[] {
  const lines: string[] = [];
  const breakdown = options.deterministicScore.breakdown || calculateScore(options.findings);
  lines.push('VibeGuard Security Policy');
  lines.push('');
  lines.push(`Score: ${options.deterministicScore.score === null ? 'N/A' : `${options.deterministicScore.score}/100`} (${options.deterministicScore.grade}, ${options.deterministicScore.status})`);
  lines.push(`Findings: ${options.findings.length}`);
  lines.push(`Critical: ${breakdown.critical}`);
  lines.push(`High: ${breakdown.high}`);
  lines.push(`Medium: ${breakdown.medium}`);
  lines.push(`Low: ${breakdown.low}`);
  lines.push('');
  lines.push(`Policy: ${options.policyPassed ? 'PASS' : 'FAIL'}`);
  lines.push(`Threshold: ${options.failThreshold.toUpperCase()}`);
  lines.push(`Cloud sync: ${options.syncStatus || 'SKIPPED'}`);
  if (options.syncError) lines.push(`Cloud sync detail: ${options.syncError}`);
  lines.push(`Exit code: ${options.exitCode ?? (options.policyPassed ? 0 : 1)}`);

  if (options.verbose && options.scanners) {
    lines.push('');
    lines.push('Scanner Telemetry:');
    for (const sr of options.scanners) {
      const reason = sr.reason ? ` — ${sr.reason.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').slice(0, 180)}` : '';
      lines.push(` - ${sr.scanner.padEnd(14)}: ${sr.state.padEnd(14)} (${sr.durationMs || 0}ms) findings: ${sr.findingsCount || 0}${reason}`);
    }
  }
  return lines;
}

export function generateJsonOutput(options: {
  deterministicScore: DeterministicScore;
  findings: NormalizedFinding[];
  coverageData: ScannerCoverage;
  activeDomainsCount: number;
  postureStatus: 'COMPLETE' | 'PARTIAL' | 'UNASSESSED';
  scanners: ScannerTelemetry[];
  gitInfo: { name: string; branch: string; commit: string };
  policyPassed: boolean;
  syncStatus?: 'SYNCED' | 'SKIPPED' | 'FAILED';
  syncError?: string;
  failThreshold: string;
  durationMs: number;
}) {
  return {
    score: options.deterministicScore.score,
    grade: options.deterministicScore.grade,
    postureStatus: options.postureStatus,
    coverage: {
      assessedDomains: options.activeDomainsCount,
      totalDomains: 7,
      domains: options.coverageData
    },
    deductions: options.deterministicScore.deductions,
    breakdown: options.deterministicScore.breakdown || calculateScore(options.findings),
    explanation: options.deterministicScore.explanation,
    findings: options.findings.map(f => ({
      id: f.id,
      title: maskSecrets(f.title || ''),
      severity: f.severity,
      scanner: f.scanner,
      file: f.file,
      line: f.line,
      ruleId: f.ruleId,
      cwe: f.cwe,
      owasp: f.owasp
    })),
    scanners: options.scanners,
    repository: {
      name: options.gitInfo.name,
      branch: options.gitInfo.branch,
      commit: options.gitInfo.commit
    },
    policyResult: {
      passed: options.policyPassed,
      threshold: options.failThreshold.toUpperCase()
    },
    cloudSync: options.syncStatus || 'SKIPPED',
    cloudSyncError: options.syncError,
    durationMs: options.durationMs
  };
}

export function evaluatePolicy(
  failThreshold: string,
  breakdown: { critical: number; high: number; medium: number; low: number },
  totalFindings: number
): { passed: boolean; exitCode: number } {
  const normThreshold = (failThreshold || 'high').toLowerCase();
  let thresholdBreached = false;

  if (normThreshold === 'critical') {
    thresholdBreached = breakdown.critical > 0;
  } else if (normThreshold === 'high') {
    thresholdBreached = breakdown.critical > 0 || breakdown.high > 0;
  } else if (normThreshold === 'medium') {
    thresholdBreached = breakdown.critical > 0 || breakdown.high > 0 || breakdown.medium > 0;
  } else if (normThreshold === 'low') {
    thresholdBreached = totalFindings > 0;
  }

  return {
    passed: !thresholdBreached,
    exitCode: thresholdBreached ? 1 : 0
  };
}
