#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ContextualExplainer } from '@maverick006/ai-engine';
import { calculateScore as calculateEngineScore } from '@maverick006/security-engine';
import { NormalizedFinding, Severity, ScannerCoverage } from '@maverick006/types';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { 
  renderDashboard, 
  calculateScore, 
  getGitInfo, 
  AIRemediationData, 
  ScannerTelemetry,
  renderCIOutput,
  generateJsonOutput,
  evaluatePolicy
} from './formatter';
import { loadCredentials, saveCredentials, clearCredentials, getCredentialsPath } from './credentials';
import readline from 'readline';

const program = new Command();

program
  .name('vibeguard')
  .description('VIBEGUARD: Cloud + Security Posture CLI')
  .version('1.0.12');

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

    const isJson = Boolean(options.json);
    const isSilent = options.ci || isJson;

    const spinner = ora({
      text: chalk.hex('#00E5FF')('Orchestrating security scanners across repository...'),
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

      try {
        const { SemgrepScanner } = require('@maverick006/scanner-semgrep');
        scanners.push(new SemgrepScanner());
      } catch {}

      try {
        const { GitleaksScanner } = require('@maverick006/scanner-gitleaks');
        scanners.push(new GitleaksScanner());
      } catch {}

      try {
        const { NpmAuditScanner } = require('@maverick006/scanner-npm-audit');
        scanners.push(new NpmAuditScanner());
      } catch {}

      try {
        const { TrivyScanner } = require('@maverick006/scanner-trivy');
        scanners.push(new TrivyScanner());
      } catch {}

      try {
        const { CheckovScanner } = require('@maverick006/scanner-checkov');
        scanners.push(new CheckovScanner());
      } catch {}

      try {
        const { ZapScanner } = require('@maverick006/scanner-zap');
        scanners.push(new ZapScanner());
      } catch {}

      try {
        const { AwsCspmScanner } = require('@maverick006/scanner-aws-cspm');
        scanners.push(new AwsCspmScanner());
      } catch {}

      const orchestrator = new Orchestrator(scanners, { concurrencyLimit: 3 });

      const scanResult = await orchestrator.runScan({
        scanId: `scan-${Date.now()}`,
        repositoryPath: scanDir,
        branch: 'main'
      });

      findings = scanResult.findings || [];
      scannerResults = scanResult.scannerResults || [];
      coverageData = scanResult.coverage || coverageData;
    } catch (err: any) {
      if (!isJson) {
        console.error(chalk.red('Orchestrator encountered an execution error:'), err.message || err);
      }
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

    if (findings.length > 0 && !options.ci && !isJson && (options.fix || true)) {
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
          if (primaryFinding.file && existsSync(join(scanDir, primaryFinding.file))) {
            const content = readFileSync(join(scanDir, primaryFinding.file), 'utf-8');
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
    const policyEvaluation = evaluatePolicy(failThreshold, deterministicScore.breakdown, findings.length);
    const policyPassed = policyEvaluation.passed;
    const thresholdBreached = !policyPassed;

    // Cloud synchronization tracking
    let syncStatus: 'SYNCED' | 'SKIPPED' | 'FAILED' = 'SKIPPED';
    if (options.sync) {
      const creds = loadCredentials();
      if (!creds || !creds.token) {
        syncStatus = 'FAILED';
        if (!isJson && !options.ci) {
          console.log(chalk.red('\n✖ Authentication required for cloud sync.'));
          console.log(chalk.yellow("  Run 'vibeguard login' to authenticate with VibeGuard Cloud, or omit --sync for 100% offline local scanning.\n"));
        }
      } else {
        try {
          const API_URL = creds.apiUrl || process.env.VIBEGUARD_API_URL || 'http://localhost:3001';
          const repoName = gitInfo.name || 'Local Project';
          const repoUrl = (gitInfo as any).remoteUrl || gitInfo.name || 'local';

          const response = await fetch(`${API_URL}/api/scans/upload`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${creds.token}`
            },
            body: JSON.stringify({
              repositoryName: repoName,
              repositoryUrl: repoUrl,
              numericScore: deterministicScore.score,
              score: deterministicScore.grade,
              findings
            })
          });
          
          syncStatus = response.ok ? 'SYNCED' : 'FAILED';
        } catch {
          syncStatus = 'FAILED';
        }
      }
    }

    // Transform scanner telemetry
    const scannerTelemetryList: ScannerTelemetry[] = scannerResults.map(s => ({
      scanner: s.scanner,
      state: s.state,
      durationMs: s.durationMs,
      findingsCount: s.findings ? s.findings.length : 0,
      reason: s.reason
    }));

    const activeDomainsCount = Object.values(coverageData).filter(Boolean).length;
    const postureStatus = activeDomainsCount === 7 ? 'COMPLETE' : 'PARTIAL';

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
        failThreshold,
        durationMs: elapsedMs
      });

      console.log(JSON.stringify(jsonOutput, null, 2));
      process.exit(thresholdBreached ? 1 : (hasSystemError ? 2 : 0));
      return;
    }

    // 2. CI Mode (Directive 18: Minimal, clean, automation-friendly)
    if (options.ci) {
      const ciLines = renderCIOutput({
        deterministicScore,
        findings,
        policyPassed,
        failThreshold,
        scanners: scannerTelemetryList,
        verbose: Boolean(options.verbose)
      });
      for (const line of ciLines) {
        console.log(line);
      }

      process.exit(thresholdBreached ? 1 : (hasSystemError ? 2 : 0));
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
      policyThreshold: failThreshold,
      verbose: Boolean(options.verbose)
    });

    if (hasSystemError) {
      process.exit(2);
    }

    if (thresholdBreached) {
      process.exit(1);
    }

    process.exit(0);
  });

program
  .command('login')
  .description('Authenticate CLI with VibeGuard Cloud')
  .option('-e, --email <email>', 'Account email')
  .option('-p, --password <password>', 'Account password')
  .option('--api-url <url>', 'VibeGuard API URL', process.env.VIBEGUARD_API_URL || 'http://localhost:3001')
  .action(async (options) => {
    let email = options.email;
    let password = options.password;
    const apiUrl = options.apiUrl || process.env.VIBEGUARD_API_URL || 'http://localhost:3001';

    // Interactive prompt if flags not passed and TTY is active
    if ((!email || !password) && process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const question = (query: string) => new Promise<string>((res) => rl.question(query, res));

      if (!email) {
        email = await question(chalk.cyan('Enter VibeGuard Email: '));
      }
      if (!password) {
        password = await question(chalk.cyan('Enter VibeGuard Password: '));
      }
      rl.close();
    }

    if (!email || !password) {
      console.error(chalk.red('Error: Email and password are required. Use --email and --password flags.'));
      process.exit(1);
    }

    const spinner = ora(chalk.cyan('Authenticating with VibeGuard Cloud...')).start();

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json();

      if (!response.ok) {
        spinner.fail(chalk.red(`Authentication failed: ${data.error || 'Invalid credentials'}`));
        process.exit(1);
      }

      saveCredentials({
        token: data.token,
        user: data.user,
        apiUrl
      });

      spinner.succeed(chalk.green('Successfully authenticated with VibeGuard Cloud!'));
      console.log('');
      console.log(chalk.gray('  Account:  ') + chalk.white.bold(data.user.email) + (data.user.name ? chalk.gray(` (${data.user.name})`) : ''));
      console.log(chalk.gray('  API Host: ') + chalk.cyan(apiUrl));
      console.log(chalk.gray('  Stored:   ') + chalk.dim(getCredentialsPath()));
      console.log('');
      console.log(chalk.white('Cloud sync is now enabled. Run scans with ') + chalk.cyan('vibeguard scan --sync') + chalk.white(' to stream telemetry.'));
      console.log('');
    } catch (err: any) {
      spinner.fail(chalk.red(`Connection error: Could not reach VibeGuard API at ${apiUrl}`));
      console.error(chalk.dim(err.message || err));
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Log out and remove local VibeGuard Cloud credentials')
  .action(() => {
    clearCredentials();
    console.log(chalk.green('\n✓ Successfully logged out from VibeGuard Cloud.'));
    console.log(chalk.gray('  Stored session cleared. Local scanning remains 100% operational.\n'));
  });

const authCmd = program.command('auth').description('Manage VibeGuard Cloud authentication');

authCmd
  .command('status')
  .description('Display current VibeGuard Cloud authentication status')
  .action(async () => {
    const creds = loadCredentials();
    if (!creds || !creds.token) {
      console.log(chalk.yellow('\n○ VibeGuard Cloud Status: NOT AUTHENTICATED'));
      console.log(chalk.gray("  Run 'vibeguard login' to connect your CLI with VibeGuard Cloud.\n"));
      return;
    }

    console.log(chalk.green('\n● VibeGuard Cloud Status: AUTHENTICATED'));
    console.log(chalk.gray('  User:     ') + chalk.white.bold(creds.user.email) + (creds.user.name ? chalk.gray(` (${creds.user.name})`) : ''));
    console.log(chalk.gray('  API URL:  ') + chalk.cyan(creds.apiUrl));
    console.log(chalk.gray('  Saved:    ') + chalk.dim(creds.savedAt || 'Unknown'));
    console.log('');
  });

program.parse(process.argv);

