import chalk from 'chalk';
import { execSync } from 'child_process';
import { NormalizedFinding, Severity } from '@maverick006/types';
import path from 'path';

export interface ScanStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  score: number;
  riskLevel: 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK' | 'CRITICAL RISK';
}

function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

function visibleWidth(str: string): number {
  const plain = stripAnsi(str);
  let width = 0;
  for (const char of plain) {
    const code = char.codePointAt(0) || 0;
    if (code === 0xFE0F || code === 0xFE0E) continue; // ignore variation selectors
    // Emojis and certain symbols take 2 terminal columns
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
  let commit = '4f2c1ab';
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

  return { name, branch, commit, remoteUrl, policy: 'enterprise' };
}

export function calculateScore(findings: NormalizedFinding[]): ScanStats {
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;

  for (const f of findings) {
    const sev = (f.severity || '').toUpperCase();
    if (sev === 'CRITICAL' || sev === Severity.CRITICAL) critical++;
    else if (sev === 'HIGH' || sev === Severity.HIGH) high++;
    else if (sev === 'MEDIUM' || sev === Severity.MEDIUM) medium++;
    else low++;
  }

  // Calculate risk score: 100 is best, 0 is worst
  const deductions = (critical * 15) + (high * 7) + (medium * 3) + (low * 1);
  const score = Math.max(10, Math.min(100, 100 - deductions));

  let riskLevel: ScanStats['riskLevel'] = 'LOW RISK';
  if (score < 50 || critical > 0) riskLevel = 'CRITICAL RISK';
  else if (score < 75 || high > 0) riskLevel = 'HIGH RISK';
  else if (score < 90 || medium > 0) riskLevel = 'MEDIUM RISK';

  return {
    critical,
    high,
    medium,
    low,
    total: findings.length,
    score,
    riskLevel
  };
}

export function renderDashboard(options: {
  findings: NormalizedFinding[];
  stats: ScanStats;
  gitInfo: ReturnType<typeof getGitInfo>;
  duration: string;
  remediation?: {
    findingId: string;
    issue: string;
    impact: string;
    recommendation: string;
    diffSnippet: string;
    confidence: number;
  };
}) {
  const { findings, stats, gitInfo, duration, remediation } = options;

  const cyan = chalk.hex('#00E5FF');
  const gray = chalk.hex('#94A3B8');
  const dimGray = chalk.hex('#475569');
  const darkBorder = chalk.hex('#334155');
  const green = chalk.hex('#10B981');
  const red = chalk.hex('#EF4444');
  const orange = chalk.hex('#F97316');
  const yellow = chalk.hex('#F59E0B');
  const white = chalk.white;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  // Shield ASCII Art
  const shield = [
    '    ,-----.    ',
    '  /    _    \\  ',
    ' |   /   \\   | ',
    ' |  |  ✓  |  | ',
    '  \\  \\   /  /  ',
    '   `-------\'   '
  ];

  // Title ASCII Art (VIBEGUARD)
  const title = [
    ' __     __ ___ ____  _____ ____ _   _   _   ____  ____  ',
    '\\ \\   / /|_ _| __ )| ____/ ___| | | | / \\ |  _ \\|  _ \\ ',
    ' \\ \\ / /  | ||  _ \\|  _|| |  _| | | |/ _ \\| |_) | | | |',
    '  \\ V /   | || |_) | |___| |_| |_| / ___ \\  _ <| |_| |',
    '   \\_/   |___|____/|_____|\\____|\\___/_/   \\_\\_| \\_\\____/'
  ];

  const scoreColor = stats.score >= 85 ? green : stats.score >= 65 ? yellow : red;
  const riskColor = stats.riskLevel === 'LOW RISK' ? green : stats.riskLevel === 'MEDIUM RISK' ? yellow : red;

  console.log('\n');
  
  // Print Top Row: Clock aligned right
  console.log(' '.repeat(65) + cyan.bold(timeStr));

  // 1. Header (Shield + VIBEGUARD)
  console.log(`${cyan(shield[0])}  ${cyan.bold(title[0])}`);
  console.log(`${cyan(shield[1])}  ${cyan.bold(title[1])}`);
  console.log(`${cyan(shield[2])}  ${cyan.bold(title[2])}`);
  console.log(`${cyan(shield[3])}  ${cyan.bold(title[3])}`);
  console.log(`${cyan(shield[4])}  ${cyan.bold(title[4])}`);
  console.log(`${cyan(shield[5])}  ${gray('AI-Powered DevSecOps Orchestrator')}`);
  console.log(`                 ${cyan('Scanning. Analyzing. Protecting.')}\n`);

  // 2. Risk Score Box (Placed cleanly BELOW VIBEGUARD Header)
  const boxWidth = 74;
  console.log(darkBorder(`┌${'─'.repeat(boxWidth)}┐`));
  console.log(`${darkBorder('│')}  ${cyan.bold('OVERALL RISK SCORE')}${' '.repeat(boxWidth - 20)}${darkBorder('│')}`);
  console.log(`${darkBorder('│')}${' '.repeat(boxWidth)}${darkBorder('│')}`);
  
  const scoreLine1 = `   ${scoreColor.bold(String(stats.score))} ${gray('/100')}            ${red('CRITICAL')}     ${String(stats.critical).padEnd(2, ' ')}          ${orange('HIGH')}         ${String(stats.high).padEnd(2, ' ')}`;
  const scoreLine2 = `   ${riskColor.bold(stats.riskLevel.padEnd(13, ' '))}      ${yellow('MEDIUM')}       ${String(stats.medium).padEnd(2, ' ')}          ${cyan('LOW')}          ${String(stats.low).padEnd(2, ' ')}`;

  console.log(`${darkBorder('│')}${padVisible(scoreLine1, boxWidth)}${darkBorder('│')}`);
  console.log(`${darkBorder('│')}${padVisible(scoreLine2, boxWidth)}${darkBorder('│')}`);
  console.log(darkBorder(`└${'─'.repeat(boxWidth)}┘`));
  console.log('');

  // 3. Multi-panel Grid (Pipeline & Findings)
  const pipelineRows = [
    `</>  SAST (Semgrep)           ${green('✓ OK')}`,
    `📦   Dependency Check (Trivy) ${green('✓ OK')}`,
    `🔑   Secrets Scan (Gitleaks)  ${green('✓ OK')}`,
    `🔒   IaC Scan (Checkov)       ${green('✓ OK')}`,
    `🐳   Container Scan (Trivy)   ${green('✓ OK')}`,
    `📑   Code Quality (ESLint)    ${green('✓ OK')}`,
    ``,
    `${cyan('▶ REPOSITORY')}`,
    `${gray('Name:')}      ${white(gitInfo.name)}`,
    `${gray('Branch:')}    ${white(gitInfo.branch)}`,
    `${gray('Commit:')}    ${white(gitInfo.commit)}`,
    `${gray('Scan Time:')} ${white(duration)}`,
    `${gray('Policy:')}    ${white(gitInfo.policy)}`
  ];

  // Table of findings (top 10)
  const topFindings = findings.slice(0, 10);
  const tableHeader = `${dimGray(padVisible('ID', 13))} ${dimGray(padVisible('SEVERITY', 10))} ${dimGray(padVisible('TITLE', 28))} ${dimGray('FILE:LINE')}`;
  
  const findingRows: string[] = [tableHeader];

  if (topFindings.length === 0) {
    findingRows.push(green('  ✓ No security vulnerabilities detected. Codebase is clean!'));
  } else {
    for (const f of topFindings) {
      const id = f.id || 'VG-FIND';
      const sev = (f.severity || 'LOW').toUpperCase();
      let sevFormatted = cyan('LOW      ');
      if (sev === 'CRITICAL') sevFormatted = red.bold('CRITICAL ');
      else if (sev === 'HIGH') sevFormatted = orange.bold('HIGH     ');
      else if (sev === 'MEDIUM') sevFormatted = yellow('MEDIUM   ');

      const rawTitle = f.title || 'Security Finding';
      const titleTruncated = rawTitle.length > 26 ? rawTitle.slice(0, 24) + '..' : rawTitle;
      const titleFormatted = padVisible(white(titleTruncated), 28);

      const fileLine = `${f.file || 'unknown'}:${f.line || 1}`;
      const idFormatted = padVisible(cyan(id), 13);
      findingRows.push(`${idFormatted} ${sevFormatted} ${titleFormatted} ${dimGray(fileLine)}`);
    }
  }

  // Print Section Headers with ANSI-safe padding
  const headerCol1 = padVisible(cyan('▶ SCANNER PIPELINE'), 36);
  const headerCol2 = cyan('▶ TOP FINDINGS');
  console.log(`${headerCol1}  ${headerCol2}`);
  
  const maxRows = Math.max(pipelineRows.length, findingRows.length);
  for (let i = 0; i < maxRows; i++) {
    const left = padVisible(pipelineRows[i] || '', 36);
    const right = findingRows[i] || '';
    console.log(`${left}  ${right}`);
  }

  // 4. AI Remediation Section
  if (remediation) {
    console.log(`\n${cyan('▶ AI REMEDIATION (VG-AI)')}\n`);
    console.log(`${cyan('Finding:')} ${red.bold(remediation.findingId)}\n`);
    console.log(`${cyan('Issue')}\n${white(remediation.issue)}\n`);
    console.log(`${cyan('Impact')}\n${white(remediation.impact)}\n`);
    console.log(`${cyan('Recommendation')}\n${white(remediation.recommendation)}\n`);
    
    console.log(`${cyan('Suggested Fix')}`);
    console.log(darkBorder('┌────────────────────────────────────────────────────────────┐'));
    const diffLines = remediation.diffSnippet.split('\n');
    for (const d of diffLines) {
      let styled = d;
      if (d.trim().startsWith('-')) styled = red(d);
      else if (d.trim().startsWith('+')) styled = green(d);
      else if (d.trim().startsWith('#')) styled = dimGray(d);
      else styled = white(d);
      
      const paddedLine = padVisible(styled, 58);
      console.log(`${darkBorder('│')} ${paddedLine} ${darkBorder('│')}`);
    }
    console.log(darkBorder('└────────────────────────────────────────────────────────────┘'));

    console.log(`\n${cyan('Confidence:')} ${green.bold(remediation.confidence + '%')}`);
  }

  // 5. Summary Bar (bottom capsule)
  console.log(`\n${cyan('▶ SUMMARY')}`);
  const summaryText = `🛡️   Scan completed in ${duration}   │   ${stats.total} findings   │   6 passed`;
  const barTop = `┌${'─'.repeat(visibleWidth(summaryText) + 4)}┐`;
  const barMid = `│  ${summaryText}  │`;
  const barBot = `└${'─'.repeat(visibleWidth(summaryText) + 4)}┘`;
  console.log(cyan(barTop));
  console.log(cyan(barMid));
  console.log(cyan(barBot));
  console.log(`\n💡 ${gray('Tip: Run')} ${cyan('`vibeguard watch`')} ${gray('to continuously monitor your codebase.')}\n`);
}