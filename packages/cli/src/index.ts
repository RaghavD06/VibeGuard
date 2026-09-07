#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ContextualExplainer } from '@maverick006/ai-engine';
import { NormalizedFinding, Severity } from '@maverick006/types';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { renderDashboard, calculateScore, getGitInfo } from './formatter';

const program = new Command();

program
  .name('vibeguard')
  .description('AI-Powered DevSecOps Orchestrator CLI')
  .version('1.0.11');

program
  .command('scan [path]')
  .description('Run a security scan on the current directory or target path')
  .option('-d, --dir <path>', 'Directory to scan', process.cwd())
  .option('--fix', 'Automatically generate AI remediation fixes and interactive diff')
  .option('--ci', 'Run in non-interactive CI mode and exit with policy status code')
  .action(async (targetPath, options) => {
    const scanDir = resolve(targetPath || options.dir || process.cwd());
    const startTime = Date.now();
    let hasSystemError = false;

    // Use a minimal spinner if in CI mode, or bypass ora entirely if preferred.
    // For simplicity, we just won't render the interactive dashboard if --ci is set.
    const spinner = ora({
      text: chalk.hex('#00E5FF')('Scanning repository for vulnerabilities (SAST, SCA, Secrets, IaC)...'),
      spinner: 'dots',
      isSilent: options.ci
    }).start();

    let findings: NormalizedFinding[] = [];

    try {
      // Initialize the security orchestrator and scanners
      const { Orchestrator } = require('@maverick006/security-engine');
      const scanners: any[] = [];

      try {
        const { NpmAuditScanner } = require('@maverick006/scanner-npm-audit');
        scanners.push(new NpmAuditScanner());
      } catch (e) {}

      try {
        const { TrivyScanner } = require('@maverick006/scanner-trivy');
        scanners.push(new TrivyScanner());
      } catch (e) {}

      try {
        const { SemgrepScanner } = require('@maverick006/scanner-semgrep');
        scanners.push(new SemgrepScanner());
      } catch (e) {}

      try {
        const { GitleaksScanner } = require('@maverick006/scanner-gitleaks');
        scanners.push(new GitleaksScanner());
      } catch (e) {}

      try {
        const { CheckovScanner } = require('@maverick006/scanner-checkov');
        scanners.push(new CheckovScanner());
      } catch (e) {}

      try {
        const { ZapScanner } = require('@maverick006/scanner-zap');
        scanners.push(new ZapScanner());
      } catch (e) {}

      const orchestrator = new Orchestrator(scanners);

      const scanResult = await orchestrator.runScan({
        scanId: `scan-${Date.now()}`,
        repositoryUrl: 'local',
        repositoryPath: scanDir,
        branch: 'main'
      });

      findings = scanResult.findings || [];
    } catch (err) {
      console.error(chalk.red('Orchestrator failed to run scans.'), err);
      hasSystemError = true;
    }

    spinner.stop();

    const elapsedMs = Date.now() - startTime;
    const duration = elapsedMs > 60000 
      ? `${Math.floor(elapsedMs / 60000)}m ${Math.floor((elapsedMs % 60000) / 1000)}s`
      : `${(elapsedMs / 1000).toFixed(1)}s`;

    const stats = calculateScore(findings);
    const gitInfo = getGitInfo(scanDir);

    let remediationData: any = undefined;

    // Generate AI Remediation only if not in CI mode to save time, or if explicitly asked
    if (findings.length > 0 && !options.ci && (options.fix || true)) {
      try {
        const explainer = new ContextualExplainer();
        const primaryFinding = findings[0];

        let snippet = primaryFinding.codeSnippet || '';
        if (primaryFinding.file && existsSync(join(scanDir, primaryFinding.file))) {
          const content = readFileSync(join(scanDir, primaryFinding.file), 'utf-8');
          const lines = content.split('\n');
          const targetLine = primaryFinding.line || 1;
          snippet = lines.slice(Math.max(0, targetLine - 3), targetLine + 3).join('\n');
        }

        const explanation = await explainer.explainFinding(primaryFinding, { codeContext: snippet });

        remediationData = {
          findingId: primaryFinding.id,
          issue: explanation.summary,
          impact: explanation.details || 'Potential security impact based on context.',
          recommendation: explanation.remediation,
          diffSnippet: explanation.codeFix || '',
          confidence: 90
        };
      } catch (e: any) {
        if (!options.ci) {
          console.error(chalk.yellow('AI Remediation generation failed.'), e);
        }
      }
    }

    if (!options.ci) {
      // Render the beautiful cyber dashboard interactively
      renderDashboard({
        findings,
        stats,
        gitInfo,
        duration,
        remediation: remediationData
      });
    } else {
      // CI Output
      console.log(`VibeGuard CI Scan Complete. Duration: ${duration}`);
      console.log(`Findings: ${findings.length}`);
      console.log(`Risk Score: ${stats.score}/100 (${stats.riskLevel})`);
      const critical = findings.filter(f => (f.severity || '').toUpperCase() === Severity.CRITICAL).length;
      const high = findings.filter(f => (f.severity || '').toUpperCase() === Severity.HIGH).length;
      console.log(`Critical: ${critical}, High: ${high}`);
    }

    // Sync with Web Dashboard
    const syncSpinner = ora({
      text: chalk.dim('Syncing results to VibeGuard Dashboard...'),
      spinner: 'dots',
      isSilent: options.ci
    }).start();

    try {
      const API_URL = process.env.VIBEGUARD_API_URL || 'https://vibeguard-eep3.onrender.com';
      const API_KEY = process.env.VIBEGUARD_API_KEY || 'dev-api-key-123';
      const repoName = gitInfo.name || 'Local Project';
      const repoUrl = (gitInfo as any).remoteUrl || gitInfo.name || 'local';

      const response = await fetch(`${API_URL}/api/scans/upload`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          repositoryName: repoName,
          repositoryUrl: repoUrl,
          numericScore: stats.score,
          score: stats.riskLevel,
          findings: findings
        })
      });
      
      if (response.ok) {
        const baseUrl = process.env.VIBEGUARD_DASHBOARD_URL || 'https://vibe-guard-web.vercel.app';
        const dashboardUrl = `${baseUrl.replace(/\/$/, '')}/dashboard?repo=${encodeURIComponent(repoName)}`;
        syncSpinner.succeed(chalk.green(`Results synced to dashboard: ${chalk.cyan.underline(dashboardUrl)}`));
      } else {
        syncSpinner.fail(chalk.red(`Failed to sync results to dashboard (${response.status} ${response.statusText}).`));
      }
    } catch (e) {
      syncSpinner.warn(chalk.yellow('Dashboard API unreachable. Skipping sync.'));
    }

    // Exit codes
    if (hasSystemError) {
      process.exit(2);
    }
    
    // Policy fail if we have CRITICAL or HIGH findings
    const criticalOrHighCount = findings.filter(f => {
      const s = (f.severity || '').toUpperCase();
      return s === Severity.CRITICAL || s === Severity.HIGH;
    }).length;

    if (criticalOrHighCount > 0) {
      if (options.ci) console.error(chalk.red('Security Policy FAILED.'));
      process.exit(1);
    }

    if (options.ci) console.log(chalk.green('Security Policy PASSED.'));
    process.exit(0);
  });

program.parse(process.argv);

