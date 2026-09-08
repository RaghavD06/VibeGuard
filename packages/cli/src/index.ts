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
    if (process.env.VIBEGUARD_API_KEY) {
      try {
        const API_URL = process.env.VIBEGUARD_API_URL || 'https://vibeguard-eep3.onrender.com';
        const repoName = gitInfo.name || 'Local Project';
        const repoUrl = (gitInfo as any).remoteUrl || gitInfo.name || 'local';

        const response = await fetch(`${API_URL}/api/scans/upload`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VIBEGUARD_API_KEY}`
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

program.parse(process.argv);
