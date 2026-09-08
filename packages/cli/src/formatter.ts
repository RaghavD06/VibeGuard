import chalk from 'chalk';
import { execSync } from 'child_process';
import { NormalizedFinding, Severity, ScannerCoverage, ScannerState, DeterministicScore } from '@maverick006/types';
import path from 'path';

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
  policyThreshold?: string;
  verbose?: boolean;
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
  const {
    findings,
    stats,
    deterministicScore,
    coverage,
    gitInfo,
    duration,
    scanners,
    remediation,
    syncStatus,
    policyThreshold,
    verbose
  } = options;

  const cyan = chalk.hex('#00E5FF');
  const gray = chalk.hex('#94A3B8');
  const dimGray = chalk.hex('#475569');
  const darkBorder = chalk.hex('#334155');
  const green = chalk.hex('#10B981');
  const red = chalk.hex('#EF4444');
  const orange = chalk.hex('#F97316');
  const yellow = chalk.hex('#F59E0B');
  const white = chalk.white;

  // Active domains count (out of 7)
  const domainKeys: (keyof ScannerCoverage)[] = [
    'code',
    'dependencies',
    'secrets',
    'containers',
    'iac',
    'web',
    'cloud'
  ];
  const activeDomainsCount = domainKeys.filter(k => coverage[k]).length;
  const isPartial = activeDomainsCount < 7;

  // Title ASCII Art
  const title = [
    ' __     __ ___ ____  _____ ____ _   _   _   ____  ____  ',
    '\\ \\   / /|_ _| __ )| ____/ ___| | | | / \\ |  _ \\|  _ \\ ',
    ' \\ \\ / /  | ||  _ \\|  _|| |  _| | | |/ _ \\| |_) | | | |',
    '  \\ V /   | || |_) | |___| |_| |_| / ___ \\  _ <| |_| |',
    '   \\_/   |___|____/|_____|\\____|\\___/_/   \\_\\_| \\_\\____/'
  ];

  console.log('\n');

  // 1. Header (VIBEGUARD - Cloud + Security Posture)
  for (const line of title) {
    console.log(cyan.bold(line));
  }
  console.log(`\n${white.bold('VIBEGUARD')}  ${dimGray('│')}  ${cyan('Cloud + Security Posture')}`);
  console.log(gray('Scanning. Analyzing. Protecting.\n'));

  // 2. Redesigned Security Posture Header (Honest Partial Posture Representation)
  const boxWidth = 76;
  console.log(darkBorder(`┌─ SECURITY POSTURE ${'─'.repeat(boxWidth - 21)}┐`));
  console.log(`${darkBorder('│')}${' '.repeat(boxWidth)}${darkBorder('│')}`);

  const scoreNum = deterministicScore?.score ?? stats.score;
  const gradeLetter = deterministicScore?.grade ?? stats.grade;
  const gradeColor = gradeLetter === 'A' ? green : gradeLetter === 'B' ? cyan : gradeLetter === 'C' ? yellow : red;

  const scoreLine = `  ${gradeColor.bold(String(scoreNum))} ${gray('/ 100')}       ${gradeColor.bold('Grade ' + gradeLetter)}`;
  console.log(`${darkBorder('│')}${padVisible(scoreLine, boxWidth)}${darkBorder('│')}`);

  const postureBadge = isPartial
    ? yellow.bold('PARTIAL POSTURE') + dimGray(` (${activeDomainsCount} / 7 security domains assessed)`)
    : green.bold('COMPLETE POSTURE') + dimGray(' (7 / 7 security domains assessed)');
  const statusLine = `  ${postureBadge}`;
  console.log(`${darkBorder('│')}${padVisible(statusLine, boxWidth)}${darkBorder('│')}`);
  console.log(`${darkBorder('│')}${' '.repeat(boxWidth)}${darkBorder('│')}`);

  const critStr = stats.critical > 0 ? red.bold(`${stats.critical} Critical`) : dimGray('0 Critical');
  const highStr = stats.high > 0 ? orange.bold(`${stats.high} High`) : dimGray('0 High');
  const medStr = stats.medium > 0 ? yellow.bold(`${stats.medium} Medium`) : dimGray('0 Medium');
  const lowStr = stats.low > 0 ? cyan(`${stats.low} Low`) : dimGray('0 Low');
  const findingsLine = `  ${critStr}   ${highStr}   ${medStr}   ${lowStr}   ${gray(`(${stats.total} total ${stats.total === 1 ? 'finding' : 'findings'})`)}`;
  console.log(`${darkBorder('│')}${padVisible(findingsLine, boxWidth)}${darkBorder('│')}`);

  const coverageLine = `  Coverage: ${cyan(`${activeDomainsCount} / 7`)} security domains`;
  console.log(`${darkBorder('│')}${padVisible(coverageLine, boxWidth)}${darkBorder('│')}`);
  console.log(darkBorder(`└${'─'.repeat(boxWidth)}┘`));
  console.log('');

  // 3. Truthful Scanner Status & Security Domains
  console.log(cyan.bold('▶ SCANNER COVERAGE'));
  console.log('');

  for (const s of scanners) {
    const dur = s.durationMs ? `${(s.durationMs / 1000).toFixed(1)}s` : '0.1s';
    const name = s.scanner.padEnd(16);

    let stateStr = '';
    const normState = String(s.state).toUpperCase();

    if (normState === 'SUCCESS') {
      const count = s.findingsCount || 0;
      const countLabel = `${count} ${count === 1 ? 'finding' : 'findings'}`;
      stateStr = `${green('✓ SUCCESS')}        ${white(countLabel.padEnd(14))} ${dimGray(dur)}`;
    } else if (normState === 'NOT_INSTALLED') {
      stateStr = `${dimGray('○ NOT INSTALLED')}`;
    } else if (normState === 'SKIPPED') {
      const r = (s.reason || '').toLowerCase();
      if (r.includes('not applicable') || r.includes('no live web') || r.includes('no iac') || r.includes('credentials not configured')) {
        stateStr = `${dimGray('— NOT APPLICABLE')}  ${dimGray(s.reason ? `(${s.reason.replace(/^Skipped:\s*/i, '')})` : '')}`;
      } else {
        stateStr = `${yellow('⚠ SKIPPED')}         ${dimGray(s.reason || '')}`;
      }
    } else if (normState === 'TIMEOUT') {
      stateStr = `${red('⏱ TIMEOUT')}         ${dimGray(`(${dur})`)}`;
    } else if (normState === 'FAILED') {
      stateStr = `${red('✗ FAILED')}          ${dimGray(s.reason || '')}`;
    } else {
      stateStr = `${dimGray('— ' + normState)}`;
    }

    console.log(`  ${name} ${stateStr}`);
  }

  // Domain mapping summary
  console.log(`\n  ${gray(`Domain Assessment: ${activeDomainsCount} / 7`)}`);
  const domainLabels: { key: keyof ScannerCoverage; label: string }[] = [
    { key: 'dependencies', label: 'Dependencies' },
    { key: 'code', label: 'Code' },
    { key: 'secrets', label: 'Secrets' },
    { key: 'containers', label: 'Containers' },
    { key: 'iac', label: 'IaC' },
    { key: 'web', label: 'Web/API' },
    { key: 'cloud', label: 'Cloud' }
  ];

  const domainStr = domainLabels
    .map(d => (coverage[d.key] ? green(`✓ ${d.label}`) : dimGray(`○ ${d.label}`)))
    .join('  ');
  console.log(`  ${domainStr}\n`);

  // 4. Score Breakdown
  console.log(cyan.bold('▶ SCORE BREAKDOWN'));
  console.log('');
  const breakdownWidth = 48;
  console.log(`  ${padVisible('Base score', breakdownWidth - 6)} ${white('100')}`);

  if (stats.critical > 0) {
    const critDed = stats.critical * 30;
    console.log(`  ${padVisible(`${stats.critical} × Critical finding${stats.critical > 1 ? 's' : ''}`, breakdownWidth - 6)} ${red(`- ${critDed}`)}`);
  }
  if (stats.high > 0) {
    const highDed = stats.high * 10;
    console.log(`  ${padVisible(`${stats.high} × High finding${stats.high > 1 ? 's' : ''}`, breakdownWidth - 6)} ${orange(`- ${highDed}`)}`);
  }
  if (stats.medium > 0) {
    const medDed = stats.medium * 3;
    console.log(`  ${padVisible(`${stats.medium} × Medium finding${stats.medium > 1 ? 's' : ''}`, breakdownWidth - 6)} ${yellow(`- ${medDed}`)}`);
  }
  if (stats.low > 0) {
    const lowDed = stats.low * 1;
    console.log(`  ${padVisible(`${stats.low} × Low finding${stats.low > 1 ? 's' : ''}`, breakdownWidth - 6)} ${cyan(`- ${lowDed}`)}`);
  }
  if (stats.total === 0) {
    console.log(`  ${padVisible('No security deductions across assessed domains', breakdownWidth - 6)} ${green('+   0')}`);
  }

  console.log(`  ${darkBorder('─'.repeat(breakdownWidth))}`);
  console.log(`  ${padVisible('Final score', breakdownWidth - 6)} ${white.bold(String(scoreNum))}`);
  console.log(`  ${padVisible('Grade', breakdownWidth - 6)} ${gradeColor.bold(gradeLetter)}`);

  if (stats.critical > 0) {
    console.log(`  ${red('Critical finding detected: Grade capped at F')}`);
  }
  console.log('');

  // 5. Findings Table
  console.log(cyan.bold('▶ FINDINGS'));
  console.log('');

  const displayLimit = 5;
  const topFindings = findings.slice(0, displayLimit);

  const colId = 15;
  const colSev = 12;
  const colIssue = 36;
  const colLoc = 24;

  const headerRow = `  ${dimGray(padVisible('ID', colId))} ${dimGray(padVisible('SEVERITY', colSev))} ${dimGray(padVisible('ISSUE', colIssue))} ${dimGray('LOCATION')}`;
  console.log(headerRow);
  console.log(`  ${darkBorder('─'.repeat(colId + colSev + colIssue + colLoc))}`);

  if (findings.length === 0) {
    console.log(`  ${green('✓ No vulnerabilities detected in scanned domains.')}`);
  } else {
    findings.forEach((f, idx) => {
      if (idx >= displayLimit) return;
      // Consistent ID format VG-FIND-001
      const id = f.id || `VG-FIND-${String(idx + 1).padStart(3, '0')}`;
      const sev = (f.severity || 'LOW').toUpperCase();

      let sevFormatted = cyan('LOW     ');
      if (sev === 'CRITICAL') sevFormatted = red.bold('CRITICAL');
      else if (sev === 'HIGH') sevFormatted = orange.bold('HIGH    ');
      else if (sev === 'MEDIUM') sevFormatted = yellow('MEDIUM  ');

      const rawTitle = maskSecrets(f.title || 'Security Finding');
      const truncatedTitle = rawTitle.length > 33 ? rawTitle.slice(0, 31) + '..' : rawTitle;

      const loc = `${f.file || 'repo'}:${f.line || 1}`;
      const row = `  ${white(padVisible(id, colId))} ${padVisible(sevFormatted, colSev)} ${white(padVisible(truncatedTitle, colIssue))} ${dimGray(loc)}`;
      console.log(row);
    });

    if (findings.length > displayLimit) {
      console.log(`\n  ${dimGray(`Showing ${displayLimit} of ${findings.length} findings`)}`);
    }
  }
  console.log('');

  // 6. Structured AI Remediation Section (Directive 10 & 11)
  if (remediation) {
    if (remediation.status === 'UNAVAILABLE') {
      console.log(cyan.bold('▶ AI REMEDIATION · UNAVAILABLE'));
      console.log('');
      console.log(gray('  Reason:'));
      console.log(`  ${yellow(remediation.unavailableReason || 'NVIDIA_API_KEY not configured.')}`);
      console.log(`  ${dimGray('Scanning, deterministic scoring, and policy enforcement remain 100% operational.')}\n`);
    } else {
      console.log(cyan.bold('▶ AI REMEDIATION · OPTIONAL'));
      console.log('');
      console.log(`  ${gray('Finding:')}  ${white.bold(remediation.findingId)}`);
      if (remediation.severity) {
        console.log(`  ${gray('Severity:')} ${white(remediation.severity)}`);
      }
      console.log('');

      console.log(`  ${cyan('ISSUE')}`);
      console.log(`  ${white(maskSecrets(remediation.issue))}\n`);

      if (remediation.impact) {
        console.log(`  ${cyan('IMPACT')}`);
        console.log(`  ${white(maskSecrets(remediation.impact))}\n`);
      }

      if (remediation.recommendation) {
        console.log(`  ${cyan('RECOMMENDED FIX')}`);
        console.log(`  ${white(maskSecrets(remediation.recommendation))}\n`);
      }

      console.log(`  ${cyan('SUGGESTED FIX')}`);
      if (remediation.hasConcretePatch && remediation.suggestedFix) {
        console.log(`  ${darkBorder('┌────────────────────────────────────────────────────────────┐')}`);
        const lines = maskSecrets(remediation.suggestedFix).split('\n');
        for (const line of lines) {
          let colored = white(line);
          if (line.trim().startsWith('+')) colored = green(line);
          else if (line.trim().startsWith('-')) colored = red(line);
          else if (line.trim().startsWith('#') || line.trim().startsWith('//')) colored = dimGray(line);
          console.log(`  ${darkBorder('│')} ${padVisible(colored, 58)} ${darkBorder('│')}`);
        }
        console.log(`  ${darkBorder('└────────────────────────────────────────────────────────────┘')}`);

        if (remediation.confidence) {
          console.log(`\n  ${gray('Confidence:')} ${green.bold(remediation.confidence + '%')}`);
        }
        console.log(`  ${gray('Status:')}     ${white.bold(remediation.status)}`);
      } else {
        console.log(`  ${yellow('No patch generated — guidance only.')}\n`);
        console.log(`  ${gray('Status:')}     ${yellow.bold('GUIDANCE ONLY')}`);
      }
      console.log('');
    }
  }

  // 7. Repository Metadata (Directive 13)
  console.log(cyan.bold('▶ REPOSITORY'));
  console.log('');
  console.log(`  ${gray('Name'.padEnd(12))} ${white(gitInfo.name)}`);
  console.log(`  ${gray('Branch'.padEnd(12))} ${white(gitInfo.branch)}`);
  console.log(`  ${gray('Commit'.padEnd(12))} ${white(gitInfo.commit)}`);
  console.log(`  ${gray('Duration'.padEnd(12))} ${white(duration)}`);
  if (policyThreshold) {
    console.log(`  ${gray('Policy'.padEnd(12))} ${white('fail-on ' + policyThreshold)}`);
  }
  console.log('');

  // 8. Truthful Summary (Directive 14)
  console.log(cyan.bold('▶ SUMMARY'));
  console.log('');
  const evaluatedCount = scanners.length;
  const executedCount = scanners.filter(s => String(s.state).toUpperCase() === 'SUCCESS').length;

  console.log(`  ${green('✓')} Scan completed in ${duration}`);
  console.log(`  ${green('✓')} ${evaluatedCount} scanners evaluated`);
  console.log(`  ${green('✓')} ${executedCount} scanner${executedCount === 1 ? '' : 's'} executed`);
  console.log(`  ${green('✓')} ${stats.total} findings detected (${stats.critical} critical, ${stats.high} high, ${stats.medium} medium, ${stats.low} low)`);
  console.log('');

  // 9. Local vs Cloud Synchronization Status (Directive 15)
  console.log(`  ${green('✓')} Local scan completed`);
  if (syncStatus === 'SYNCED') {
    console.log(`  ${green('✓')} Results synced to VibeGuard Cloud (Tenant Isolated)`);
  } else if (syncStatus === 'FAILED') {
    console.log(`  ${red('✗')} Cloud sync failed (local result preserved)`);
  } else {
    console.log(`  ${dimGray('○')} Cloud sync skipped — run 'vibeguard scan --sync' to stream telemetry`);
  }

  // 10. Privacy Guarantee (Directive 16)
  console.log(`\n  ${dimGray('Privacy: Source code remains local. Only normalized security metadata is synchronized.')}\n`);
}

export function renderCIOutput(options: {
  deterministicScore: DeterministicScore;
  findings: NormalizedFinding[];
  policyPassed: boolean;
  failThreshold: string;
  scanners?: ScannerTelemetry[];
  verbose?: boolean;
}): string[] {
  const lines: string[] = [];
  const breakdown = options.deterministicScore.breakdown || calculateScore(options.findings);
  lines.push('VibeGuard Security Policy');
  lines.push('');
  lines.push(`Score: ${options.deterministicScore.score}/100 (${options.deterministicScore.grade})`);
  lines.push(`Findings: ${options.findings.length}`);
  lines.push(`Critical: ${breakdown.critical}`);
  lines.push(`High: ${breakdown.high}`);
  lines.push(`Medium: ${breakdown.medium}`);
  lines.push(`Low: ${breakdown.low}`);
  lines.push('');
  lines.push(`Policy: ${options.policyPassed ? 'PASS' : 'FAIL'}`);
  lines.push(`Threshold: ${options.failThreshold.toUpperCase()}`);

  if (options.verbose && options.scanners) {
    lines.push('');
    lines.push('Scanner Telemetry:');
    for (const sr of options.scanners) {
      lines.push(` - ${sr.scanner.padEnd(14)}: ${sr.state.padEnd(14)} (${sr.durationMs || 0}ms) findings: ${sr.findingsCount || 0}`);
    }
  }
  return lines;
}

export function generateJsonOutput(options: {
  deterministicScore: DeterministicScore;
  findings: NormalizedFinding[];
  coverageData: ScannerCoverage;
  activeDomainsCount: number;
  postureStatus: 'COMPLETE' | 'PARTIAL';
  scanners: ScannerTelemetry[];
  gitInfo: { name: string; branch: string; commit: string };
  policyPassed: boolean;
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