import { SecurityScanner, ScannerCapability } from '@maverick006/security-engine';
import { ScanInput, ScannerResult, ScannerState } from '@maverick006/types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseGitleaksOutput } from './parser';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export class GitleaksScanner implements SecurityScanner {
  public name = 'Gitleaks';
  public version = 'unknown';

  public capabilities: ScannerCapability = {
    category: 'secrets'
  };

  async scan(input: ScanInput): Promise<ScannerResult> {
    const startTime = new Date();
    let rawOutput = '';
    
    try {
      const safePath = path.resolve(input.repositoryPath);
      const gitleaksCmd = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks';
      const { stdout } = await execFileAsync(gitleaksCmd, ['detect', '--source', safePath, '--no-git', '--report-format', 'json', '--report-path', '-'], {
        timeout: 300000,
        maxBuffer: 1024 * 1024 * 50
      });
      
      rawOutput = stdout;
      const findings = parseGitleaksOutput(input.scanId, rawOutput);
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
          reason: 'Gitleaks binary not found on PATH',
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
          reason: 'Gitleaks scan timed out',
          findings: [],
          error: error.message,
          startTime,
          endTime,
          durationMs
        };
      }

      // Gitleaks returns exit code 1 if secrets are present
      if (error.stdout && (error.stdout.startsWith('[') || error.stdout.includes('"RuleID"'))) {
        try {
          rawOutput = error.stdout;
          const findings = parseGitleaksOutput(input.scanId, rawOutput);
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
        error: error.message || 'Gitleaks execution failed',
        rawOutput: error.stdout || '',
        startTime,
        endTime,
        durationMs
      };
    }
  }
}
