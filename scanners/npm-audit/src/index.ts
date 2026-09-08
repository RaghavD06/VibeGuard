import { SecurityScanner, ScannerCapability } from '@maverick006/security-engine';
import { ScanInput, ScannerResult, ScannerState } from '@maverick006/types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseNpmAuditOutput } from './parser';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

export class NpmAuditScanner implements SecurityScanner {
  public name = 'npm-audit';
  public version = 'unknown';

  public capabilities: ScannerCapability = {
    category: 'dependencies',
    detectApplicability: (repoPath: string) => {
      const safePath = path.resolve(repoPath);
      return fs.existsSync(path.join(safePath, 'package.json'));
    }
  };

  async scan(input: ScanInput): Promise<ScannerResult> {
    const startTime = new Date();
    let rawOutput = '';
    
    const safePath = path.resolve(input.repositoryPath);
    const hasPackageJson = fs.existsSync(path.join(safePath, 'package.json'));

    if (!hasPackageJson) {
      const endTime = new Date();
      return {
        scanner: this.name,
        success: true,
        state: ScannerState.SKIPPED,
        reason: 'Skipped: No package.json detected in repository',
        findings: [],
        rawOutput: 'No package.json found',
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime()
      };
    }

    try {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const args = ['audit', '--json', '--prefix', safePath, '--omit=dev'];
      
      if (fs.existsSync(path.join(safePath, 'package-lock.json'))) {
        args.push('--package-lock-only');
      }

      const { stdout } = await execFileAsync(npmCmd, args, {
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 50,
        shell: process.platform === 'win32'
      });
      
      rawOutput = stdout;
      const findings = parseNpmAuditOutput(input.scanId, rawOutput);
      const endTime = new Date();
      
      return {
        scanner: this.name,
        success: true,
        state: ScannerState.SUCCESS,
        findings,
        rawOutput,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime()
      };
    } catch (error: any) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      if (error.code === 'ENOENT') {
        return {
          scanner: this.name,
          success: false,
          state: ScannerState.NOT_INSTALLED,
          reason: 'npm executable was not found on PATH',
          findings: [],
          error: error.message,
          startTime,
          endTime,
          durationMs
        };
      }

      if (error.code === 'ETIMEDOUT') {
        return {
          scanner: this.name,
          success: false,
          state: ScannerState.TIMEOUT,
          reason: 'npm-audit execution timed out',
          findings: [],
          error: error.message,
          startTime,
          endTime,
          durationMs
        };
      }

      // npm audit exits > 0 if vulnerabilities are found
      if (error.stdout && error.stdout.includes('"auditReportVersion":')) {
        try {
          rawOutput = error.stdout;
          const findings = parseNpmAuditOutput(input.scanId, rawOutput);
          return {
            scanner: this.name,
            success: true,
            state: ScannerState.SUCCESS,
            findings,
            rawOutput,
            startTime,
            endTime,
            durationMs
          };
        } catch {
          // ignore parsing error
        }
      }

      return {
        scanner: this.name,
        success: false,
        state: ScannerState.FAILED,
        findings: [],
        error: error.message || 'npm audit execution failed',
        rawOutput: error.stdout || '',
        startTime,
        endTime,
        durationMs
      };
    }
  }
}
