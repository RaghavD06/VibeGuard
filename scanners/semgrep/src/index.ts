import { SecurityScanner, ScannerCapability } from '@maverick006/security-engine';
import { ScanInput, ScannerResult, ScannerState } from '@maverick006/types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseSemgrepOutput } from './parser';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export class SemgrepScanner implements SecurityScanner {
  public name = 'Semgrep';
  public version = 'unknown';

  public capabilities: ScannerCapability = {
    category: 'code'
  };

  /**
   * Executes the Semgrep scanner safely.
   */
  async scan(input: ScanInput): Promise<ScannerResult> {
    const startTime = new Date();
    let rawOutput = '';
    
    try {
      const safePath = path.resolve(input.repositoryPath);
      const semgrepCmd = process.platform === 'win32' ? 'semgrep.exe' : 'semgrep';
      const { stdout } = await execFileAsync(semgrepCmd, ['scan', '--json', '--quiet', safePath], {
        timeout: 300000,
        maxBuffer: 1024 * 1024 * 50
      });
      
      rawOutput = stdout;
      const findings = parseSemgrepOutput(input.scanId, rawOutput);
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
          reason: 'Semgrep binary not found on PATH',
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
          reason: 'Semgrep scan timed out',
          findings: [],
          error: error.message,
          startTime,
          endTime,
          durationMs
        };
      }

      // Semgrep returns exit code 1 if it finds issues, which causes exec to throw
      if (error.stdout && error.stdout.includes('"results":')) {
        try {
          rawOutput = error.stdout;
          const findings = parseSemgrepOutput(input.scanId, rawOutput);
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
          // If we couldn't parse the output even when it had results, it's a real error
        }
      }

      return {
        scanner: this.name,
        success: false,
        state: ScannerState.FAILED,
        findings: [],
        error: error.message || 'Semgrep execution failed',
        rawOutput: error.stdout || '',
        startTime,
        endTime,
        durationMs
      };
    }
  }
}
