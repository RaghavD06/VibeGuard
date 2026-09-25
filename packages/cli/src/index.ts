#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ContextualExplainer } from '@maverick006/ai-engine';
import { calculateScore as calculateEngineScore } from '@maverick006/security-engine';
import { NormalizedFinding, Severity, ScannerCoverage } from '@maverick006/types';
import { readFileSync, existsSync, realpathSync } from 'fs';
import { resolve, sep } from 'path';
import { 
  renderDashboard, 
  calculateScore, 
  getGitInfo, 
  AIRemediationData, 
  ScannerTelemetry,
  renderCIOutput,
  generateJsonOutput,
  evaluatePolicy,
  maskSecrets
} from './formatter';
import { DEFAULT_API_URL, loadCredentials, saveCredentials, clearCredentials, getCredentialsPath, normalizeApiUrl } from './credentials';
import { isPersistedScanReceipt } from './sync-receipt';
import { color, error, header, muted, promptHidden, promptVisible, row, success, warning, writeLines } from './terminal-ui';

const program = new Command();
const packageVersion = require('../package.json').version;

program
  .name('vibeguard')
  .description('Security scanning for modern repositories.')
  .version(packageVersion);

program.configureHelp({
  formatHelp: (command, helper) => {
    if (command.parent) {
      const usage = `Usage: ${helper.commandUsage(command)}`;
      const options = helper.visibleOptions(command).map(option => `  ${helper.optionTerm(option).padEnd(28)}${helper.optionDescription(option)}`);
      return [...header(`VibeGuard ${command.name()}`), command.description(), '', usage, '', 'Options', ...options, ''].join('\n');
    }
    return [
      ...header('VibeGuard', 'Security scanning for modern repositories.'),
      '',
      color.strong('USAGE'),
      '  vibeguard scan <path> [options]',
      '',
      color.strong('COMMANDS'),
      '  scan          Scan a repository',
      '  login         Authenticate with VibeGuard Cloud',
      '  logout        Revoke cloud sessions and sign out',
      '  whoami        Show the current cloud account',
      '  auth status   Show authentication status',
      '',
      color.strong('SCAN OPTIONS'),
      '  --sync                 Upload results to VibeGuard Cloud',
      '  --fix                  Generate advisory remediation',
      '  --ci                   Run in deterministic CI mode',
      '  --json                 Output pure machine-readable JSON',
      '  --fail-on <severity>   Set the policy failure threshold',
      '  --verbose              Show scanner diagnostics',
      '',
      color.strong('EXAMPLES'),
      '  vibeguard scan .',
      '  vibeguard scan . --sync',
      '  vibeguard scan . --ci --fail-on critical',
      '  vibeguard scan . --json',
      ''
    ].join('\n');
  }
});

program
  .command('scan [path]')
  .description('Run a security scan on the current directory or target path')
  .option('-d, --dir <path>', 'Directory to scan', process.cwd())
  .option('--fix', 'Generate optional advisory AI remediation suggestion')
  .option('--ci', 'Run in non-interactive CI mode and exit with policy status code')
  .option('--json', 'Output machine-readable JSON summary')
  .option('-v, --verbose', 'Show detailed scanner telemetry, install hints, and diagnostics')
  .option('--fail-on <severity>', 'Severity threshold to trigger non-zero exit in CI (critical, high, medium, low)', 'high')
  .option('--sync', 'Sync scan telemetry and findings with authenticated VibeGuard Cloud account')
  .action(async (targetPath, options) => {
    const scanDir = resolve(targetPath || options.dir || process.cwd());
    const startTime = Date.now();
    let hasSystemError = false;
    let systemErrorDetail: string | undefined;

    const isJson = Boolean(options.json);
    const isSilent = options.ci || isJson || !process.stderr.isTTY;

    const spinner = ora({
      text: color.brand(`Scanning ${scanDir}`),
      spinner: 'dots',
      isSilent
    }).start();

    let findings: NormalizedFinding[] = [];
    let scannerResults: any[] = [];
    let coverageData: ScannerCoverage = {
      code: false,
      dependencies: false,
      secrets: false,
      containers: false,
      iac: false,
      web: false,
      cloud: false
    };

    try {
      const { Orchestrator } = require('@maverick006/security-engine');
      const scanners: any[] = [];
      const loadFailures: any[] = [];
      const recordLoadFailure = (scanner: string, err: unknown) => loadFailures.push({
        scanner,
        state: 'NOT_INSTALLED',
        reason: err instanceof Error ? err.message : 'Scanner adapter could not be loaded',
        findings: [],
        durationMs: 0
      });

      try {
        const { SemgrepScanner } = require('@maverick006/scanner-semgrep');
        scanners.push(new SemgrepScanner());
      } catch (err) { recordLoadFailure('Semgrep', err); }

      try {
        const { GitleaksScanner } = require('@maverick006/scanner-gitleaks');
        scanners.push(new GitleaksScanner());
      } catch (err) { recordLoadFailure('Gitleaks', err); }

      try {
        const { NpmAuditScanner } = require('@maverick006/scanner-npm-audit');
        scanners.push(new NpmAuditScanner());
      } catch (err) { recordLoadFailure('npm-audit', err); }

      try {
        const { TrivyScanner } = require('@maverick006/scanner-trivy');
        scanners.push(new TrivyScanner());
      } catch (err) { recordLoadFailure('Trivy', err); }

      try {
        const { CheckovScanner } = require('@maverick006/scanner-checkov');
        scanners.push(new CheckovScanner());
      } catch (err) { recordLoadFailure('Checkov', err); }

      try {
        const { ZapScanner } = require('@maverick006/scanner-zap');
        scanners.push(new ZapScanner());
      } catch (err) { recordLoadFailure('OWASP ZAP', err); }

      try {
        const { AwsCspmScanner } = require('@maverick006/scanner-aws-cspm');
        scanners.push(new AwsCspmScanner());
      } catch (err) { recordLoadFailure('Prowler', err); }

      const orchestrator = new Orchestrator(scanners, { concurrencyLimit: 3 });

      const scanResult = await orchestrator.runScan({
        scanId: `scan-${Date.now()}`,
        repositoryPath: scanDir,
        branch: 'main'
      });

      findings = scanResult.findings || [];
      scannerResults = [...(scanResult.scannerResults || []), ...loadFailures];
      coverageData = scanResult.coverage || coverageData;
    } catch (err: any) {
      systemErrorDetail = err?.message || String(err);
      hasSystemError = true;
    }

    spinner.stop();

    const elapsedMs = Date.now() - startTime;
    const duration = elapsedMs > 60000 
      ? `${Math.floor(elapsedMs / 60000)}m ${Math.floor((elapsedMs % 60000) / 1000)}s`
      : `${(elapsedMs / 1000).toFixed(1)}s`;

    // Ensure all findings follow the consistent VG-FIND-001 format
    findings.forEach((f, idx) => {
      if (!f.id || !f.id.startsWith('VG-FIND-')) {
        f.id = `VG-FIND-${String(idx + 1).padStart(3, '0')}`;
      }
    });

    const deterministicScore = calculateEngineScore(findings, coverageData);
    const stats = calculateScore(findings);
    const gitInfo = getGitInfo(scanDir);

    // Structure AI remediation (advisory only)
    let remediationData: AIRemediationData | undefined = undefined;

    if (findings.length > 0 && !options.ci && !isJson && options.fix) {
      const primaryFinding = findings[0];
      const hasAiKey = Boolean(process.env.NVIDIA_API_KEY);

      if (!hasAiKey) {
        remediationData = {
          findingId: primaryFinding.id || 'VG-FIND-001',
          severity: primaryFinding.severity,
          issue: primaryFinding.title || 'Security finding identified',
          hasConcretePatch: false,
          status: 'UNAVAILABLE',
          unavailableReason: 'NVIDIA_API_KEY not configured.'
        };
      } else {
        try {
          const explainer = new ContextualExplainer();
          let snippet = primaryFinding.codeSnippet || '';
          const candidate = primaryFinding.file ? resolve(scanDir, primaryFinding.file) : null;
          if (candidate && candidate.startsWith(realpathSync(scanDir) + sep) && existsSync(candidate) &&
              realpathSync(candidate).startsWith(realpathSync(scanDir) + sep)) {
            const content = readFileSync(candidate, 'utf-8').slice(0, 100_000);
            const lines = content.split('\n');
            const targetLine = primaryFinding.line || 1;
            snippet = lines.slice(Math.max(0, targetLine - 3), targetLine + 3).join('\n');
          }

          const explanation = await explainer.explainFinding(primaryFinding, { codeContext: snippet });
          const hasConcretePatch = Boolean(
            explanation.codeFix &&
            explanation.codeFix.trim() &&
            !explanation.codeFix.toLowerCase().includes('no patch')
          );

          remediationData = {
            findingId: primaryFinding.id || 'VG-FIND-001',
            severity: primaryFinding.severity,
            issue: explanation.summary,
            impact: explanation.details,
            recommendation: explanation.remediation,
            suggestedFix: hasConcretePatch ? explanation.codeFix : undefined,
            hasConcretePatch,
            confidence: hasConcretePatch ? 90 : undefined,
            status: hasConcretePatch ? 'AWAITING REVIEW' : 'GUIDANCE ONLY'
          };
        } catch {
          remediationData = {
            findingId: primaryFinding.id || 'VG-FIND-001',
            severity: primaryFinding.severity,
            issue: primaryFinding.title,
            hasConcretePatch: false,
            status: 'UNAVAILABLE',
            unavailableReason: 'AI service temporarily unavailable.'
          };
        }
      }
    }

    // Policy verification
    const failThreshold = (options.failOn || 'high').toLowerCase();
    const policyBreakdown = deterministicScore.breakdown || stats;
    const policyEvaluation = evaluatePolicy(failThreshold, policyBreakdown, findings.length);
    const unassessed = deterministicScore.grade === 'UNASSESSED';
    const scannerFailure = scannerResults.some(s => ['FAILED', 'TIMEOUT', 'NOT_INSTALLED'].includes(String(s.state)));
    const policyPassed = !unassessed && !scannerFailure && policyEvaluation.passed;
    const thresholdBreached = !policyPassed;

    // Cloud synchronization tracking
    let syncStatus: 'SYNCED' | 'SKIPPED' | 'FAILED' = 'SKIPPED';
    let syncError: string | undefined;
    if (options.sync) {
      const creds = loadCredentials();
      if (!creds || !creds.token) {
        syncStatus = 'FAILED';
        syncError = "Authentication required. Run 'vibeguard login' and retry.";
        if (!isJson && !options.ci) {
          console.log(chalk.red('\n✖ Authentication required for cloud sync.'));
          console.log(chalk.yellow("  Run 'vibeguard login' to authenticate with VibeGuard Cloud, or omit --sync for 100% offline local scanning.\n"));
        }
      } else {
        try {
          const API_URL = normalizeApiUrl(creds.apiUrl);
          const repoName = gitInfo.name || 'Local Project';
          const repoUrl = (gitInfo as any).remoteUrl || gitInfo.name || 'local';

          const response = await fetch(`${API_URL}/api/scans/upload`, {
            method: 'POST',
            signal: AbortSignal.timeout(20_000),
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${creds.token}`
            },
            body: JSON.stringify({
              repositoryName: repoName,
              repositoryUrl: repoUrl,
              numericScore: deterministicScore.score,
              score: deterministicScore.grade,
              coverage: coverageData,
              findings: findings.map(finding => ({
                ...finding,
                title: maskSecrets(finding.title || ''),
                description: maskSecrets(finding.description || ''),
                remediation: finding.remediation ? maskSecrets(finding.remediation) : undefined,
                codeSnippet: undefined
              }))
            })
          });
          
          if (response.status === 201 && response.headers.get('content-type')?.includes('application/json')) {
            const receipt: unknown = await response.json();
            syncStatus = isPersistedScanReceipt(receipt, findings.length) ? 'SYNCED' : 'FAILED';
            if (syncStatus === 'FAILED') {
              syncError = 'Cloud persistence was not confirmed; no sync was recorded.';
            }
          } else {
            syncStatus = 'FAILED';
            syncError = response.status === 401 || response.status === 403
              ? "Authentication expired. Run 'vibeguard login' and retry."
              : `Cloud API returned HTTP ${response.status}.`;
          }
        } catch (error: any) {
          syncStatus = 'FAILED';
          syncError = error?.name === 'TimeoutError'
            ? 'Cloud API request timed out after 20 seconds.'
            : 'Cloud API could not be reached.';
        }
      }
    }

    // Transform scanner telemetry
    const scannerTelemetryList: ScannerTelemetry[] = scannerResults.map(s => ({
      scanner: s.scanner,
      state: s.state,
      durationMs: s.durationMs,
      findingsCount: s.findings ? s.findings.length : 0,
      reason: s.reason || s.error
    }));

    const activeDomainsCount = Object.values(coverageData).filter(Boolean).length;
    const postureStatus = activeDomainsCount === 0 ? 'UNASSESSED' : activeDomainsCount === 7 ? 'COMPLETE' : 'PARTIAL';

    // 1. JSON Mode (Directive 17: Pure, machine-readable JSON)
    if (isJson) {
      const jsonOutput = generateJsonOutput({
        deterministicScore,
        findings,
        coverageData,
        activeDomainsCount,
        postureStatus,
        scanners: scannerTelemetryList,
        gitInfo,
        policyPassed,
        syncStatus,
        syncError,
        failThreshold,
        durationMs: elapsedMs
      });

      console.log(JSON.stringify(jsonOutput, null, 2));
      process.exit(unassessed || hasSystemError || scannerFailure ? 2 : (thresholdBreached || syncStatus === 'FAILED' ? 1 : 0));
      return;
    }

    // 2. CI Mode (Directive 18: Minimal, clean, automation-friendly)
    if (options.ci) {
      const ciExitCode = unassessed || hasSystemError || scannerFailure ? 2 : (thresholdBreached || syncStatus === 'FAILED' ? 1 : 0);
      const ciLines = renderCIOutput({
        deterministicScore,
        findings,
        policyPassed,
        syncStatus,
        syncError,
        failThreshold,
        scanners: scannerTelemetryList,
        verbose: Boolean(options.verbose),
        exitCode: ciExitCode
      });
      for (const line of ciLines) {
        console.log(line);
      }

      process.exit(ciExitCode);
      return;
    }

    // 3. Verbose Mode Diagnostics (Directive 19)
    if (options.verbose) {
      console.log(chalk.cyan('▶ VERBOSE DIAGNOSTICS'));
      for (const sr of scannerTelemetryList) {
        let hint = '';
        if (sr.state === 'NOT_INSTALLED') {
          if (sr.scanner === 'Semgrep') hint = ' (Install: pip install semgrep or brew install semgrep)';
          else if (sr.scanner === 'Gitleaks') hint = ' (Install: brew install gitleaks or download from GitHub)';
          else if (sr.scanner === 'Trivy') hint = ' (Install: brew install trivy or see aquasecurity.github.io)';
          else if (sr.scanner === 'Checkov') hint = ' (Install: pip install checkov)';
        }
        console.log(`  • ${sr.scanner.padEnd(12)} -> ${sr.state} in ${sr.durationMs || 0}ms (${sr.findingsCount} findings)${hint}`);
      }
      console.log('');
    }

    if (hasSystemError) {
      console.error(error('Security scan could not be completed.'));
      console.error(muted('Run with --verbose for technical details.'));
      if (options.verbose && systemErrorDetail) console.error(muted(systemErrorDetail));
    }

    // 4. Interactive Terminal Dashboard
    renderDashboard({
      findings,
      stats,
      deterministicScore,
      coverage: coverageData,
      gitInfo,
      duration,
      scanners: scannerTelemetryList,
      remediation: remediationData,
      syncStatus,
      syncError,
      policyThreshold: failThreshold,
      verbose: Boolean(options.verbose),
      scanPath: scanDir
    });

    if (hasSystemError || unassessed || scannerFailure) {
      process.exit(2);
    }

    if (thresholdBreached || syncStatus === 'FAILED') {
      process.exit(1);
    }

    process.exit(0);
  });

program
  .command('login')
  .description('Authenticate CLI with VibeGuard Cloud')
  .option('-e, --email <email>', 'Account email')
  .option('-p, --password <password>', 'Account password')
  .option('--api-url <url>', 'VibeGuard API URL', process.env.VIBEGUARD_API_URL || DEFAULT_API_URL)
  .option('-v, --verbose', 'Show connection diagnostics')
  .action(async (options) => {
    let email = options.email;
    let password = options.password;
    const apiUrl = normalizeApiUrl(options.apiUrl);

    writeLines(['', ...header('VibeGuard Cloud Login'), '']);

    if ((!email || !password) && process.stdin.isTTY) {
      try {
        if (!email) {
          email = await promptVisible('Email');
        }
        if (!password) {
          password = await promptHidden('Password');
        }
      } catch {
        console.error(warning('Login cancelled.'));
        process.exitCode = 130;
        return;
      }
    }

    if (!email || !password) {
      console.error(error('Email and password are required.'));
      console.error(muted("Run 'vibeguard login' in an interactive terminal."));
      process.exit(1);
    }

    const spinner = ora({ text: 'Authenticating with VibeGuard Cloud...', isSilent: !process.stderr.isTTY }).start();

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json();

      if (!response.ok) {
        spinner.stop();
        console.error(error(`Authentication failed: ${data.error || 'Invalid credentials'}`));
        process.exit(1);
      }

      saveCredentials({
        token: data.token,
        user: data.user,
        apiUrl
      });

      spinner.stop();
      writeLines([
        success('Authentication successful'),
        '',
        row('User', data.user.email),
        row('Cloud', apiUrl),
        row('Credentials', getCredentialsPath()),
        '',
        muted("Cloud sync is enabled. Run 'vibeguard scan . --sync'."),
        ''
      ]);
    } catch (err: any) {
      spinner.stop();
      console.error(error('Unable to connect to VibeGuard Cloud.'));
      console.error('');
      console.error('The server could not be reached. Check your network connection and configured API URL.');
      if (options.verbose) console.error(muted(err?.message || String(err)));
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Revoke cloud sessions and remove local credentials')
  .action(async () => {
    const creds = loadCredentials();
    let revoked = !creds;
    if (creds) {
      try {
        const response = await fetch(`${creds.apiUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${creds.token}` },
          signal: AbortSignal.timeout(8000)
        });
        revoked = response.ok;
      } catch {
        revoked = false;
      }
    }
    const cleared = clearCredentials();
    if (!cleared) {
      console.error(error('Could not remove local credentials.'));
      process.exitCode = 1;
    } else if (!revoked) {
      console.error(warning('Local credentials were removed, but server revocation was not confirmed.'));
      process.exitCode = 1;
    } else {
      console.log(success('Logged out successfully.'));
    }
  });

async function showAuthStatus(): Promise<void> {
  writeLines(['', ...header('VibeGuard Authentication'), '']);
    const creds = loadCredentials();
    if (!creds || !creds.token) {
      writeLines([row('Status', warning('Not authenticated')), '', muted("Run 'vibeguard login' to connect to VibeGuard Cloud."), '']);
      return;
    }

    try {
      const response = await fetch(`${creds.apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${creds.token}` },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) {
        writeLines([
          row('Status', warning('Session expired')),
          row('User', creds.user.email),
          row('Cloud', creds.apiUrl),
          row('Token', 'Invalid'),
          '',
          muted(`Run 'vibeguard login --api-url ${DEFAULT_API_URL}'.`),
          ''
        ]);
        process.exitCode = 1;
        return;
      }
    } catch {
      writeLines([
        row('Status', warning('Cloud unavailable')),
        row('User', creds.user.email),
        row('Cloud', creds.apiUrl),
        row('Token', 'Not verified'),
        '',
        muted('Check your network connection and configured API URL.'),
        ''
      ]);
      process.exitCode = 1;
      return;
    }
    writeLines([
      row('Status', success('Authenticated')),
      row('User', creds.user.email),
      row('Cloud', creds.apiUrl),
      row('Token', 'Valid'),
      row('Saved', creds.savedAt || 'Unknown'),
      ''
    ]);
}

program
  .command('whoami')
  .description('Display currently authenticated user and VibeGuard Cloud status')
  .action(showAuthStatus);

const authCmd = program.command('auth').description('Manage VibeGuard Cloud authentication');

authCmd
  .command('status')
  .description('Display current VibeGuard Cloud authentication status')
  .action(showAuthStatus);

program.parse(process.argv);
