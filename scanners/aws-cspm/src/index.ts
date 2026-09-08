import { SecurityScanner, ScannerCapability } from '@maverick006/security-engine';
import { ScanInput, ScannerResult, ScannerState } from '@maverick006/types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseProwlerOutput } from './parser';

const execFileAsync = promisify(execFile);

export class AwsCspmScanner implements SecurityScanner {
  public name = 'Prowler';
  public version = 'unknown';

  public capabilities: ScannerCapability = {
    category: 'cloud',
    requiresCredentials: true,
    detectApplicability: () => {
      return Boolean(
        process.env.AWS_ACCESS_KEY_ID ||
        process.env.AWS_PROFILE ||
        process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
        process.env.AWS_ROLE_ARN
      );
    }
  };

  async scan(input: ScanInput): Promise<ScannerResult> {
    const startTime = new Date();
    
    // Check credentials before attempting execution
    const hasAwsCreds = Boolean(
      process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_PROFILE ||
      process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
      process.env.AWS_ROLE_ARN
    );

    if (!hasAwsCreds) {
      const endTime = new Date();
      return {
        scanner: this.name,
        success: true,
        state: ScannerState.SKIPPED,
        reason: 'Skipped: AWS credentials not configured in environment',
        findings: [],
        rawOutput: 'AWS credentials not configured',
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime()
      };
    }

    try {
      // Safe execution using execFile with argument array (no unsafe shell interpolation)
      const { stdout } = await execFileAsync('prowler', ['aws', '-M', 'json', '--quiet'], {
        timeout: 300000,
        maxBuffer: 1024 * 1024 * 50
      });
      
      const findings = parseProwlerOutput(input.scanId, stdout);
      const endTime = new Date();
      
      return {
        scanner: this.name,
        success: true,
        state: ScannerState.SUCCESS,
        findings,
        rawOutput: stdout,
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
          reason: 'Prowler binary not found on PATH',
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
          reason: 'Prowler scan timed out',
          findings: [],
          error: error.message,
          startTime,
          endTime,
          durationMs
        };
      }

      // CLI may exit non-zero when findings exist but still output valid JSON
      if (error.stdout && error.stdout.includes('"CheckID"')) {
        try {
          const findings = parseProwlerOutput(input.scanId, error.stdout);
          return {
            scanner: this.name,
            success: true,
            state: ScannerState.SUCCESS,
            findings,
            rawOutput: error.stdout,
            startTime,
            endTime,
            durationMs
          };
        } catch {
          // fallback to error
        }
      }

      return {
        scanner: this.name,
        success: false,
        state: ScannerState.FAILED,
        findings: [],
        error: error.message || 'Prowler execution failed',
        rawOutput: error.stdout || '',
        startTime,
        endTime,
        durationMs
      };
    }
  }
}
