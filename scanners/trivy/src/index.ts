import { SecurityScanner, ScannerCapability } from '@maverick006/security-engine';
import { ScanInput, ScannerResult, ScannerState } from '@maverick006/types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseTrivyOutput } from './parser';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export class TrivyScanner implements SecurityScanner {
  public name = 'Trivy';
  public version = 'unknown';

  public capabilities: ScannerCapability = {
    category: 'containers'
  };

  async scan(input: ScanInput): Promise<ScannerResult> {
    const startTime = new Date();
    let rawOutput = '';
    
    try {
      const safePath = path.resolve(input.repositoryPath);
      const trivyCmd = process.platform === 'win32' ? 'trivy.exe' : 'trivy';
      const { stdout } = await execFileAsync(trivyCmd, ['fs', '--format', 'json', safePath], {
        timeout: 300000,
        maxBuffer: 1024 * 1024 * 50
      });
      
      rawOutput = stdout;
      const findings = parseTrivyOutput(input.scanId, rawOutput);
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
          reason: 'Trivy binary not found on PATH',
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
          reason: 'Trivy scan timed out',
          findings: [],
          error: error.message,
          startTime,
          endTime,
          durationMs
        };
      }

      // Trivy might return a non-zero exit code if vulnerabilities are found
      if (error.stdout && error.stdout.includes('"SchemaVersion":')) {
        try {
          rawOutput = error.stdout;
          const findings = parseTrivyOutput(input.scanId, rawOutput);
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
        error: error.message || 'Trivy execution failed',
        rawOutput: error.stdout || '',
        startTime,
        endTime,
        durationMs
      };
    }
  }
}
